 
import { readFileSync } from 'node:fs';

import yargs from 'yargs';

import { importFrom, importFromSafe } from './lib.mjs';

function has(object) {
  return Object.keys(object).some((item) => item && item !== '$0');
}

function ready(cli, that) {
  const { homepage, site = homepage, repository } = that;

  const hasWebsite = site && site !== repository;

  const instance = cli.getInternalMethods();

  const hasCommand = has(instance.getCommandInstance().handlers);

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
    cli.epilogue(`Repository: ${repository}`);
  }

  return cli;
}

function parseBin(bin, name) {
  if (typeof bin === 'string' || !bin) {
    return name;
  }

  const bins = Object.keys(bin);

  if (bins.length === 1) {
    return bins[0];
  }

  return false;
}

export class Cheetor {
  constructor(pkg, root) {
    this.root = root;

    const {
      bin,
      homepage,
      name = 'cheetor',
      repository: { url = '' } = {},
      version,
    } = typeof pkg === 'string'
      ? JSON.parse(readFileSync(new URL(pkg, root)))
      : pkg;

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

  config(func) {
    this.cli = this.cli.then(func);

    return this;
  }

  command(...args) {
    this.cli = this.cli.then((cli) => cli.command(...args));

    return this;
  }

  commandFrom(path) {
    this.cli = this.cli.then(async (cli) => {
      const io = await importFrom(path, this.root);

      return cli.command(io);
    });

    return this;
  }

  commandSafe(path) {
    this.cli = this.cli.then((cli) =>
      importFromSafe(path, this.root).then((mod) => {
        if (mod && mod.command) {
          return cli.command(mod);
        }

        return cli;
      }),
    );

    return this;
  }

  commandSmart(func) {
    this.cli = this.cli.then(async (cli) => {
      const mod = func();

      if (mod && mod.command) {
        return cli.command(mod);
      }

      return cli;
    });

    return this;
  }

  website(site) {
    this.site = site;

    return this;
  }

  middleware(...args) {
    this.cli = this.cli.then((cli) => cli.middleware(...args));

    return this;
  }

  setup(action) {
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
