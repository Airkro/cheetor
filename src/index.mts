import { readFileSync } from 'node:fs';

import yargs from 'yargs';

import { importFrom, importFromSafe } from './lib.mts';

type Bin = string | Record<string, string> | undefined;

type Module = {
  command?: unknown;
};

type Cli = any;

type Pkg = {
  bin?: Bin;
  homepage?: string;
  name?: string;
  repository?: string | { url?: string };
  version?: string;
};

function hasKeys(object: Record<string, unknown>): boolean {
  return Object.keys(object).some((item) => item && item !== '$0');
}

function ready(cli: Cli, that: Cheetor): Cli {
  const { homepage, site = homepage, repository } = that;

  const hasWebsite = Boolean(site && site !== repository);

  const instance = cli.getInternalMethods();

  const hasCommand = hasKeys(instance.getCommandInstance().handlers);

  if (instance.getUsageInstance().getUsage().length === 0) {
    if (hasCommand) {
      cli.usage('Usage: $0 <command>');
    } else {
      cli.usage('Usage: $0');
    }
  }

  if (hasCommand) {
    cli.demandCommand(1, "Won't work without a command");
  }

  if (hasWebsite) {
    cli.epilogue(`Website: ${site}`);
  }

  if (repository) {
    cli.epilogue(
      `Repository: ${repository.replace(/^git\+/, '').replace(/\.git$/, '')}`,
    );
  }

  return cli;
}

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

    const cli = yargs(process.argv.slice(2))
      .strict()
      .alias('help', 'h')
      .alias('version', 'v')
      .hide('help')
      .version(version)
      .hide('version')
      .detectLocale(false);

    const $0 = parseBin(bin, name);

    if ($0) {
      cli.scriptName($0);
    }

    this.cli = Promise.resolve(cli);
  }

  config(func: (cli: Cli) => Cli): this {
    this.cli = this.cli.then(func);

    return this;
  }

  command(...args: unknown[]): this {
    this.cli = this.cli.then((cli) => cli.command(...args));

    return this;
  }

  commandFrom(path: string): this {
    this.cli = this.cli.then(async (cli) => {
      const io = await importFrom(path, String(this.root));

      return cli.command(io);
    });

    return this;
  }

  commandSafe(path: string): this {
    this.cli = this.cli.then((cli) =>
      importFromSafe(path, String(this.root)).then((mod) => {
        if (mod && (mod as Module).command) {
          return cli.command(mod);
        }

        return cli;
      }),
    );

    return this;
  }

  commandSmart(func: () => Module | undefined): this {
    this.cli = this.cli.then(async (cli) => {
      const mod = func();

      if (mod && mod.command) {
        return cli.command(mod);
      }

      return cli;
    });

    return this;
  }

  website(site: string): this {
    this.site = site;

    return this;
  }

  middleware(...args: unknown[]): this {
    this.cli = this.cli.then((cli) => cli.middleware(...args));

    return this;
  }

  setup(action?: (parsed: unknown) => unknown): Promise<unknown> {
    return this.cli
      .then((cli) => ready(cli, this))
      .then((cli) => {
        if (typeof action === 'function') {
          return action(cli.parse());
        }

        return cli.parse();
      });
  }
}
