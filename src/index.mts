import { Command } from 'commander';

import { importFrom, importFromSafe } from './lib.mts';

/*
Public authoring types: exported so consumers can annotate reusable command
objects, option lists, `setup()` handlers, and the `pkg` passed to `Cheetor`.
*/
export type Bin = string | Record<string, string> | undefined;

export type OptionConfig = { default?: unknown } & object;

export type OptionSpec =
  | [name: string, description: string]
  | [name: string, description: string, config: OptionConfig];

export type Module = {
  command?: string;
  describe?: string;
  options?: OptionSpec[];
  action?: (...args: unknown[]) => unknown;
};

type Cli = Command;

/**
Shared cell threaded through `build` so the action wrapper can record which
Commander `Command` actually handled the parse; `setup` reads it for `parsed`.
*/
type CommandSink = { command?: Command };

export type Parsed = {
  name: string;
  args: string[];
  options: Record<string, unknown>;
};

export type Pkg = {
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

  if (bins.length !== 1) {
    return false;
  }

  return bins[0] ?? false;
}

/*
cac took an option config object (`{ default }`); Commander takes the default
value as the third positional argument, so translate the spec before registering.
*/
function applyOption(cmd: Command, spec: OptionSpec): void {
  const [name, description, config] = spec;

  if (config && 'default' in config && config.default !== undefined) {
    cmd.addOption(cmd.createOption(name, description).default(config.default));

    return;
  }

  cmd.option(name, description);
}

/*
Normalize Commander's action args `(...positionals, options, command)` into the
shape cheetor exposes: `(...positionals, options)`. Commander's `Command`
instance is hidden so callers never depend on the engine. Options come from
`optsWithGlobals()` so a command sees the merged view of its own options plus
every ancestor's (Commander's native option inheritance), which is what makes
`cheetor parent sub --ancestor-flag` work without cheetor copying flags down the
tree itself. Returning the handler result lets setup()'s parseAsync() await
async actions before the process exits.
*/
function callAction(
  fn: (...args: unknown[]) => unknown,
  args: unknown[],
): void | Promise<void> {
  const command = args.at(-1) as Command;
  const positionals = args.slice(0, -2);

  const result = fn(...positionals, command.optsWithGlobals());

  return result as void | Promise<void>;
}

function repositoryText(repository: string): string {
  return repository.replace(/^git\+/, '').replace(/\.git$/, '');
}

/*
Nested subcommands on top of Commander. Commander matches a real command tree and
already handles option inheritance: an ancestor's option can appear after a
subcommand token and is surfaced through `optsWithGlobals()`. So cheetor declares
each option only on its own command and adds no positional-options or
ancestor-option copying of its own — it stays a thin preset over the engine.
*/
/**
The public surface handed to a `builder` callback: only the fluent authoring
methods. The engine-lowering plumbing (`build`, `createChild`, `registerModule`,
...) stays internal to cheetor so callers cannot drive the Commander
construction directly or be tripped by `command()` returning `this`.
*/
export interface SubcommandBuilder {
  command(
    name: string,
    description?: string,
    builder?: (node: SubcommandBuilder) => void,
  ): this;
  option(name: string, description: string, config?: OptionConfig): this;
  action(fn: (...args: unknown[]) => unknown): this;
  alias(name: string): this;
  description(text: string): this;
}

class CommandBuilder implements SubcommandBuilder {
  private rawName: string;

  private token: string;

  private ownDescription = '';

  private ownOptions: OptionSpec[] = [];

  private actionFn?: (...args: unknown[]) => unknown;

  private aliases: string[] = [];

  private children = new Map<string, CommandBuilder>();

  constructor(rawName: string, description?: string) {
    this.rawName = rawName;
    this.token = rawName.split(/\s+/, 1)[0] || rawName;

    if (description) {
      this.ownDescription = description;
    }
  }

  private get argSpec(): string {
    return this.rawName.split(/\s+/).slice(1).join(' ');
  }

  childList(): CommandBuilder[] {
    return this.children.values().toArray();
  }

  command(
    name: string,
    description?: string,
    builder?: (node: SubcommandBuilder) => void,
  ): this {
    const child = this.createChild(name, description);
    builder?.(child);

    return this;
  }

  createChild(name: string, description?: string): CommandBuilder {
    const child = new CommandBuilder(name, description);

    this.children.set(child.token, child);

    return child;
  }

  /**
  Turn a `Module` into a child node of this builder, so module-style commands
  share the single data-tree path (`build`) instead of a parallel one. Returns
  undefined when the module has no usable `command` string.
  */
  registerModule(module: Module): CommandBuilder | undefined {
    if (typeof module.command !== 'string') {
      return undefined;
    }

    const node = this.createChild(module.command);

    if (typeof module.describe === 'string') {
      node.description(module.describe);
    }

    const specs = module.options ?? [];

    for (const spec of specs) {
      node.option(spec[0], spec[1], spec[2]);
    }

    if (typeof module.action === 'function') {
      node.action(module.action);
    }

    return node;
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

  /**
  Materialize this node (and its subtree) as a Commander command under `parent`.
  `sink` is a shared cell that records the `Command` whose action actually runs,
  so `Cheetor.setup` can read the executed command back without re-walking the
  tree (Commander's own dispatch is the single source of truth for what matched).
  */
  build(parent: Command, sink?: CommandSink): Command {
    const nameAndArgs = this.argSpec
      ? `${this.token} ${this.argSpec}`
      : this.token;

    const cmd = parent.command(nameAndArgs).description(this.ownDescription);

    for (const alias of this.aliases) {
      cmd.alias(alias);
    }

    for (const spec of this.ownOptions) {
      applyOption(cmd, spec);
    }

    for (const child of this.childList()) {
      child.build(cmd, sink);
    }

    cmd.action((...args: unknown[]): void | Promise<void> => {
      if (sink) {
        sink.command = args.at(-1) as Command;
      }

      if (this.actionFn) {
        return callAction(this.actionFn, args);
      }

      if (this.children.size > 0) {
        const names = this.children.keys().toArray().join(', ');

        process.stderr.write(`Available subcommands: ${names}\n`);
      }
    });

    return cmd;
  }
}

function toParsed(cmd: Command, executed?: Command): Parsed {
  const leaf = executed ?? cmd;

  return {
    name: leaf.name(),
    args: [...leaf.args],
    options: { ...leaf.optsWithGlobals() },
  };
}

export class Cheetor {
  private cli: Promise<Cli>;

  private program: CommandBuilder;

  private sink: CommandSink = {};

  homepage: string | undefined;

  repository: string;

  root: string | URL;

  site: string | undefined;

  version: string | undefined;

  constructor(pkg: Pkg, root: string | URL = import.meta.url) {
    this.root = root;

    const { bin, homepage, name = 'cheetor', version } = pkg;
    const { repository } = pkg;
    const repositoryUrl =
      typeof repository === 'string' ? repository : (repository?.url ?? '');

    this.homepage = homepage;
    this.version = version;
    this.repository = repositoryUrl.includes('github.com')
      ? repositoryUrl.replace(/\.git$/, '')
      : '';

    const cli = new Command(parseBin(bin, name) || name);

    if (version) {
      cli.version(version, '-v, --version', 'Display version number');
    }

    this.cli = Promise.resolve(cli);

    this.program = new CommandBuilder('');
  }

  private decorateHelp(cli: Command): void {
    const { homepage, repository, site = homepage, version } = this;
    const hasWebsite = Boolean(site && site !== repository);

    const footer: string[] = [];

    if (hasWebsite) {
      footer.push(`Website: ${site}`);
    }

    if (repository) {
      footer.push(`Repository: ${repositoryText(repository)}`);
    }

    const footerText = footer.length > 0 ? `\n${footer.join('\n\n')}` : '';

    const visit = (cmd: Command): void => {
      cmd.helpOption('-h, --help', 'Display this message');

      // `after` help text is per-command (not inherited), so add it to each one.
      if (footerText) {
        cmd.addHelpText('after', footerText);
      }

      for (const child of cmd.commands) {
        visit(child);
      }
    };

    // `beforeAll` from the program is inherited by every subcommand's help, so
    // the version header is added just once on the root.
    if (version) {
      cli.addHelpText('beforeAll', `${cli.name()}/${version}\n`);
    }

    visit(cli);
  }

  config(func: (cli: Cli) => Cli): this {
    this.cli = this.cli.then(func);

    return this;
  }

  command(
    name: string,
    description?: string,
    builder?: (node: SubcommandBuilder) => void,
  ): this;
  command(module: Module): this;
  command(
    target: string | Module,
    description?: string,
    builder?: (node: SubcommandBuilder) => void,
  ): this {
    if (typeof target === 'string') {
      const child = this.program.createChild(target, description);

      builder?.(child);

      this.cli = this.cli.then((cli) => {
        child.build(cli, this.sink);

        return cli;
      });

      return this;
    }

    this.cli = this.cli.then((cli) => {
      this.program.registerModule(target)?.build(cli, this.sink);

      return cli;
    });

    return this;
  }

  commandFrom(path: string): this {
    this.cli = this.cli.then(async (cli) => {
      const module = await importFrom<Module>(path, String(this.root));

      this.program.registerModule(module)?.build(cli, this.sink);

      return cli;
    });

    return this;
  }

  commandSafe(path: string): this {
    this.cli = this.cli.then(async (cli) => {
      const module = await importFromSafe<Module>(path, String(this.root));

      if (module) {
        this.program.registerModule(module)?.build(cli, this.sink);
      }

      return cli;
    });

    return this;
  }

  commandSmart(func: () => Module | undefined): this {
    this.cli = this.cli.then(async (cli) => {
      const module = func();

      if (module) {
        this.program.registerModule(module)?.build(cli, this.sink);
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
    return this.cli.then(async (cli) => {
      this.decorateHelp(cli);

      // `parseAsync` awaits action handlers that return a promise, so async
      // commands complete before the returned promise (and the process) ends.
      await cli.parseAsync(process.argv);

      const parsed = toParsed(cli, this.sink.command);

      return typeof action === 'function' ? action(parsed) : parsed;
    });
  }
}
