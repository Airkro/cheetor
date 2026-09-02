import { readFileSync } from 'node:fs';

import { cac, type CAC } from 'cac';

import { importFrom, importFromSafe } from './lib.mts';

type Bin = string | Record<string, string> | undefined;

type Module = {
  command?: unknown;
  describe?: unknown;
};

type Cli = CAC;

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
    return bins[0] as string;
  }

  return false;
}

function register(cli: Cli, command: unknown, describe: unknown): void {
  if (typeof command === 'string') {
    cli.command(command, typeof describe === 'string' ? describe : '');
  }
}

export class Cheetor {
  private cli: Promise<Cli>;

  homepage: string | undefined;

  repository: string;

  root: string | URL;

  site: string | undefined;

  constructor(pkg: string | Pkg, root: string | URL = import.meta.url) {
    this.root = root;

    const data =
      typeof pkg === 'string'
        ? (JSON.parse(readFileSync(new URL(pkg, root)).toString()) as Pkg)
        : pkg;

    const { bin, homepage, name = 'cheetor', version } = data;
    const { url = '' } =
      data.repository && typeof data.repository === 'object'
        ? data.repository
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

  command(...args: unknown[]): this {
    this.cli = this.cli.then((cli) => {
      const [first, ...rest] = args;

      if (typeof first === 'string') {
        register(cli, first, rest[0]);
      } else if (first && typeof first === 'object') {
        const { command, describe } = first as Module;
        register(cli, command, describe);
      }

      return cli;
    });

    return this;
  }

  commandFrom(path: string): this {
    this.cli = this.cli.then(async (cli) => {
      const { command, describe } = (await importFrom(
        path,
        String(this.root),
      )) as Module;

      register(cli, command, describe);

      return cli;
    });

    return this;
  }

  commandSafe(path: string): this {
    this.cli = this.cli.then(async (cli) => {
      const mod = (await importFromSafe(path, String(this.root))) as
        Module | false;

      if (mod) {
        const { command, describe } = mod;

        register(cli, command, describe);
      }

      return cli;
    });

    return this;
  }

  commandSmart(func: () => Module | undefined): this {
    this.cli = this.cli.then(async (cli) => {
      const mod = func();

      if (mod) {
        const { command, describe } = mod;

        register(cli, command, describe);
      }

      return cli;
    });

    return this;
  }

  website(site: string): this {
    this.site = site;

    return this;
  }

  setup(action?: (parsed: unknown) => unknown): Promise<unknown> {
    return this.cli
      .then((cli) => {
        const { homepage, site = homepage, repository } = this;

        const hasWebsite = Boolean(site && site !== repository);

        const hasCommand = cli.commands.length > 0;

        const defaultUsage = '<command> [options]';

        const { usageText } = cli.globalCommand;

        if (!usageText || usageText === defaultUsage) {
          cli.usage(hasCommand ? '<command>' : '');
        }

        cli.globalCommand.helpCallback = (sections) => {
          if (!hasCommand) {
            sections = sections.map((section) =>
              section.title === 'Usage'
                ? { title: 'Usage', body: `  $ ${cli.name}` }
                : section,
            );
          }

          if (hasWebsite) {
            sections.push({ body: `Website: ${site}` });
          }

          if (repository) {
            sections.push({
              body: `Repository: ${repository
                .replace(/^git\+/, '')
                .replace(/\.git$/, '')}`,
            });
          }

          return sections;
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
