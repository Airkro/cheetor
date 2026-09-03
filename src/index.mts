import { cac, type CAC } from 'cac';

import { importFrom, importFromSafe } from './lib.mts';

type Bin = string | Record<string, string> | undefined;

type OptionSpec =
  | [name: string, description: string]
  | [name: string, description: string, config: object];

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

  if (typeof command === 'string') {
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
}

function repositoryText(repository: string): string {
  return repository.replace(/^git\+/, '').replace(/\.git$/, '');
}

export class Cheetor {
  private cli: Promise<Cli>;

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

  config(func: (cli: Cli) => Cli): this {
    this.cli = this.cli.then(func);

    return this;
  }

  command(name: string, description?: string): this;
  command(module: Module): this;
  command(target: string | Module, description?: string): this {
    this.cli = this.cli.then((cli) => {
      if (typeof target === 'string') {
        cli.command(target, description ?? '');
      } else {
        register(cli, target);
      }

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
        if (typeof action === 'function') {
          return action(cli.parse());
        }

        return cli.parse();
      });
  }
}
