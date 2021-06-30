/* eslint-disable promise/no-nesting */
import chalk from 'chalk';
import yargs from 'yargs';

import { importFrom, importFromSafe, requireJson } from './lib.mjs';

const { green, level } = chalk;

function ready(cli, that) {
  const { hasCommand, homepage, site = homepage, repository } = that;

  const hasWebsite = site && site !== repository;

  if (hasCommand) {
    cli.usage(`Usage: ${green('$0')} <command>`);
  } else {
    cli.usage(`Usage: ${green('$0')}`);
  }

  if (hasWebsite) {
    cli.epilogue(`Website: ${site}`);
  }

  if (repository) {
    cli.epilogue(`Repository: ${repository}`);
  }

  return cli;
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
    } = typeof pkg === 'string' ? requireJson(pkg, root) : pkg;

    this.homepage = homepage;
    this.repository = url.includes('github.com')
      ? url.replace(/\.git$/, '')
      : '';
    this.scriptName = ['string', 'undefined'].includes(typeof bin)
      ? name
      : Object.keys(bin)[0];

    this.cli = Promise.resolve(
      yargs(process.argv.slice(2))
        .strict()
        .alias('help', 'h')
        .alias('version', 'v')
        .hide('help')
        .version(version)
        .hide('version')
        .detectLocale(false)
        .scriptName(this.scriptName)
        .option('color', {
          coerce: () => level > 0,
          describe: 'Colorful output',
          type: 'boolean',
          hidden: true,
        }),
    );
  }

  config(func) {
    this.cli = this.cli.then(func);
    return this;
  }

  command(...args) {
    this.cli = this.cli.then((cli) => {
      this.hasCommand = true;
      return cli.command(...args);
    });
    return this;
  }

  commandFrom(path) {
    this.cli = this.cli.then(async (cli) => {
      const io = await importFrom(path, this.root);
      this.hasCommand = true;
      return cli.command(io);
    });
    return this;
  }

  commandSafe(path) {
    this.cli = this.cli.then((cli) =>
      importFromSafe(path, this.root).then((mod) => {
        if (mod && mod.command) {
          this.hasCommand = true;
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
        this.hasCommand = true;
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

  effect(action) {
    const { scriptName } = this;
    action({ scriptName });
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
          action(cli.parse());
        }
        if (this.hasCommand) {
          cli.demandCommand(1, "Won't work without a command");
        }
        cli.parse();
      });
  }
}
