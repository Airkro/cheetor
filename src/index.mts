import { cac, type CAC, type Command } from 'cac';

import { importFrom, importFromSafe } from './lib.mts';

type Bin = string | Record<string, string> | undefined;

type OptionConfig = object;

type OptionSpec =
  | [name: string, description: string]
  | [name: string, description: string, config: OptionConfig];

type Module = {
  command?: string;
  describe?: string;
  options?: OptionSpec[];
  action?: (...args: unknown[]) => unknown;
};

type Cli = CAC;

type Parsed = ReturnType<Cli['parse']>;

type Pkg = {
  bin?: Bin;
  homepage?: string;
  name?: string;
  repository?: string | { url?: string };
  version?: string;
};

function parseBin(bin: Bin, name: string): string | false {
  if (typeof bin === 'string' || !bin) {
    return name;
  }

  const bins = Object.keys(bin);

  if (bins.length === 1) {
    for (const only of bins) {
      return only;
    }
  }

  return false;
}

function register(cli: Cli, module: Module): void {
  const { command, describe, options, action } = module;

  if (typeof command !== 'string') {
    return;
  }

  const cmd = cli.command(
    command,
    typeof describe === 'string' ? describe : '',
  );

  const specs = options ?? [];

  for (const [name, description, config] of specs) {
    if (config) {
      cmd.option(name, description, config);
    } else {
      cmd.option(name, description);
    }
  }

  if (typeof action === 'function') {
    cmd.action(action);
  }
}

function parseOptionName(nameSpec: string): { short?: string; long?: string } {
  const tokens = nameSpec
    .trim()
    .split(/[,\s]+/)
    .filter(Boolean);
  let short: string | undefined;
  let long: string | undefined;

  for (const token of tokens) {
    const cut = token.search(/[<[]/);
    const base = (cut === -1 ? token : token.slice(0, cut)).replace(/^-+/, '');

    if (token.startsWith('--')) {
      long = base;
    } else if (token.startsWith('-')) {
      short = base;
    }
  }

  return { short, long };
}

function isValueOption(spec: OptionSpec): boolean {
  return spec[0].includes('<') || spec[0].includes('[');
}

type Matched = {
  root: CommandBuilder;
  node: CommandBuilder;
  pathTokens: string[];
  pathIndices: number[];
};

function rewriteArgv(argv: string[], matched: Matched | null): string[] {
  if (!matched) {
    return argv;
  }

  const slice = argv.slice(2);
  const skip = new Set(matched.pathIndices);
  const rest = slice.filter((_, index) => !skip.has(index));

  return [...argv.slice(0, 2), matched.pathTokens.join(' '), ...rest];
}

/*
Commander / yargs style subcommands on top of cac.

cac only matches the first argv token as the command name, so cheetor builds a
subcommand tree and, at parse time, folds the matched command path into a single
synthetic cac command that carries exactly the options valid for that path
(ancestors' options are inherited, the node's own options are added, and
nothing else). This keeps every option attributed to the correct parent/child
level instead of leaking a child's option onto its parent.
*/
export class CommandBuilder {
  private cheetor: Cheetor;

  private parent?: CommandBuilder;

  private rawName: string;

  private token: string;

  private ownDescription = '';

  private ownOptions: OptionSpec[] = [];

  private actionFn?: (...args: unknown[]) => unknown;

  private aliases: string[] = [];

  private children = new Map<string, CommandBuilder>();

  constructor(
    cheetor: Cheetor,
    parent: CommandBuilder | undefined,
    rawName: string,
    description?: string,
  ) {
    this.cheetor = cheetor;
    this.parent = parent;
    this.rawName = rawName;
    this.token = rawName.split(/\s+/, 1)[0] || rawName;

    if (description) {
      this.ownDescription = description;
    }

    if (!parent) {
      this.scheduleRegistration();
    }
  }

  private get argSpec(): string {
    return this.rawName.split(/\s+/).slice(1).join(' ');
  }

  private scheduleRegistration(): void {
    this.cheetor.schedule((cli) => {
      const { matched } = this.cheetor;

      if (matched === null || matched.root !== this) {
        const cmd = cli.command(
          this.argSpec ? `${this.token} ${this.argSpec}` : this.token,
          this.ownDescription,
        );

        this.applyAliases(cmd, this.aliases);
        this.applyOptions(cmd, this.ownOptions);

        if (this.actionFn) {
          cmd.action(this.actionFn);
        }

        return;
      }

      const { node } = matched;
      const synName = matched.pathTokens.join(' ');
      const cmd = cli.command(
        node.argSpec ? `${synName} ${node.argSpec}` : synName,
        node.ownDescription,
      );

      this.applyAliases(cmd, node.aliases);
      this.applyOptions(cmd, node.cumulativeOptions());

      cmd.action((...args: unknown[]) => {
        if (node.actionFn) {
          return node.actionFn(...args);
        }

        if (node.children.size > 0) {
          const names = node.children.keys().toArray().join(', ');

          process.stderr.write(`Available subcommands: ${names}\n`);

          return undefined;
        }

        return undefined;
      });
    });
  }

  private applyAliases(cmd: Command, aliases: string[]): void {
    for (const alias of aliases) {
      cmd.alias(alias);
    }
  }

  private applyOptions(cmd: Command, specs: OptionSpec[]): void {
    for (const spec of specs) {
      if (spec.length === 3) {
        cmd.option(spec[0], spec[1], spec[2]);
      } else {
        cmd.option(spec[0], spec[1]);
      }
    }
  }

  get tokenName(): string {
    return this.token;
  }

  get aliasList(): string[] {
    return this.aliases;
  }

  childOf(name: string): CommandBuilder | undefined {
    return this.children.get(name);
  }

  /**
  Options valid on this node: own plus every ancestor's, child wins on clash.
  */
  cumulativeOptions(): OptionSpec[] {
    const inherited = this.parent ? this.parent.cumulativeOptions() : [];
    const merged = [...inherited, ...this.ownOptions];
    const byKey = new Map<string, OptionSpec>();

    for (const spec of merged) {
      const { short, long } = parseOptionName(spec[0]);

      byKey.set(long ?? short ?? spec[0], spec);
    }

    return byKey.values().toArray();
  }

  command(name: string, description?: string): CommandBuilder {
    const child = new CommandBuilder(this.cheetor, this, name, description);

    this.children.set(child.token, child);

    return child;
  }

  alias(name: string): this {
    this.aliases.push(name);

    return this;
  }

  description(text: string): this {
    this.ownDescription = text;

    return this;
  }

  option(name: string, description: string, config?: OptionConfig): this {
    this.ownOptions.push(
      config ? [name, description, config] : [name, description],
    );

    return this;
  }

  action(fn: (...args: unknown[]) => unknown): this {
    this.actionFn = fn;

    return this;
  }

  commandSafe(path: string): this {
    this.cheetor.commandSafe(path);

    return this;
  }

  commandFrom(path: string): this {
    this.cheetor.commandFrom(path);

    return this;
  }

  commandSmart(func: () => Module | undefined): this {
    this.cheetor.commandSmart(func);

    return this;
  }

  setup<T = Parsed>(action?: (parsed: Parsed) => T): Promise<T | Parsed> {
    return this.cheetor.setup(action);
  }
}

function repositoryText(repository: string): string {
  return repository.replace(/^git\+/, '').replace(/\.git$/, '');
}

export class Cheetor {
  private cli: Promise<Cli>;

  private roots: CommandBuilder[] = [];

  matched: Matched | null = null;

  homepage: string | undefined;

  repository: string;

  root: string | URL;

  site: string | undefined;

  constructor(pkg: Pkg, root: string | URL = import.meta.url) {
    this.root = root;

    const { bin, homepage, name = 'cheetor', version } = pkg;
    const { url = '' } =
      pkg.repository && typeof pkg.repository === 'object'
        ? pkg.repository
        : {};

    this.homepage = homepage;
    this.repository = url.includes('github.com')
      ? url.replace(/\.git$/, '')
      : '';

    const cli = cac(parseBin(bin, name) || name);

    cli.help();

    if (version) {
      cli.version(version);
    }

    this.cli = Promise.resolve(cli);
  }

  private findMatched(argvSlice: string[]): Matched | null {
    let index = 0;

    while (index < argvSlice.length && argvSlice[index]?.startsWith('-')) {
      index += 1;
    }

    if (index >= argvSlice.length) {
      return null;
    }

    const at = argvSlice[index];

    if (at === undefined) {
      return null;
    }

    const root = this.roots.find(
      (entry) => entry.tokenName === at || entry.aliasList.includes(at),
    );

    if (!root) {
      return null;
    }

    const pathTokens = [root.tokenName];
    const pathIndices = [index];
    let node: CommandBuilder = root;
    let cursor = index + 1;

    while (cursor < argvSlice.length) {
      const token = argvSlice[cursor];

      if (token === undefined) {
        break;
      }

      if (token.startsWith('-')) {
        const hasInlineValue = token.includes('=');
        const name = token.replace(/^--?/, '').split('=', 1)[0] ?? '';
        const spec = this.findOptionSpec(node, name);
        const isTakesValue = spec !== undefined && isValueOption(spec);

        cursor += !hasInlineValue && isTakesValue ? 2 : 1;
      } else {
        const child = node.childOf(token);

        if (!child) {
          break;
        }

        node = child;
        pathTokens.push(token);
        pathIndices.push(cursor);
        cursor += 1;
      }
    }

    return { root, node, pathTokens, pathIndices };
  }

  private findOptionSpec(
    node: CommandBuilder,
    name: string,
  ): OptionSpec | undefined {
    return node.cumulativeOptions().find((spec) => {
      const { short, long } = parseOptionName(spec[0]);

      return long === name || short === name;
    });
  }

  config(func: (cli: Cli) => Cli): this {
    this.cli = this.cli.then(func);

    return this;
  }

  schedule(func: (cli: Cli) => void): void {
    this.cli = this.cli.then((cli) => {
      func(cli);

      return cli;
    });
  }

  command(name: string, description?: string): CommandBuilder;
  command(module: Module): this;
  command(
    target: string | Module,
    description?: string,
  ): CommandBuilder | this {
    if (typeof target === 'string') {
      const builder = new CommandBuilder(this, undefined, target, description);

      this.roots.push(builder);

      return builder;
    }

    this.cli = this.cli.then((cli) => {
      register(cli, target);

      return cli;
    });

    return this;
  }

  commandFrom(path: string): this {
    this.cli = this.cli.then(async (cli) => {
      const module = await importFrom<Module>(path, String(this.root));

      register(cli, module);

      return cli;
    });

    return this;
  }

  commandSafe(path: string): this {
    this.cli = this.cli.then(async (cli) => {
      const module = await importFromSafe<Module>(path, String(this.root));

      if (module) {
        register(cli, module);
      }

      return cli;
    });

    return this;
  }

  commandSmart(func: () => Module | undefined): this {
    this.cli = this.cli.then(async (cli) => {
      const module = func();

      if (module) {
        register(cli, module);
      }

      return cli;
    });

    return this;
  }

  website(site: string): this {
    this.site = site;

    return this;
  }

  setup<T = Parsed>(action?: (parsed: Parsed) => T): Promise<T | Parsed> {
    this.matched = this.findMatched(process.argv.slice(2));

    return this.cli
      .then((cli) => {
        const { homepage, repository, site = homepage } = this;
        const { globalCommand, name } = cli;

        const hasWebsite = Boolean(site && site !== repository);
        const hasCommand = cli.commands.length > 0;
        const { usageText } = globalCommand;
        const defaultUsage = '<command> [options]';

        if (!usageText || usageText === defaultUsage) {
          cli.usage(hasCommand ? '<command>' : '');
        }

        globalCommand.helpCallback = (sections) => {
          const next = sections.map((section) =>
            !hasCommand && section.title === 'Usage'
              ? { title: 'Usage', body: `  $ ${name}` }
              : section,
          );

          if (hasWebsite) {
            next.push({ body: `Website: ${site}` });
          }

          if (repository) {
            next.push({ body: `Repository: ${repositoryText(repository)}` });
          }

          return next;
        };

        return cli;
      })
      .then((cli) => {
        const argv = rewriteArgv(process.argv, this.matched);

        return typeof action === 'function'
          ? action(cli.parse(argv))
          : cli.parse(argv);
      });
  }
}
