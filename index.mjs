/* eslint-disable promise/no-nesting */
import chalk from 'chalk';
import { createRequire } from 'module';
import { resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import yargs from 'yargs';

const { green, level } = chalk;

function pure(path) {
  return path.startsWith('file:') ? fileURLToPath(path) : path;
}

const require = createRequire(import.meta.url);

function resolver(path, root) {
  if (!root || root === '.') {
    throw new Error('root is required');
  }
  if (!path || path === '.') {
    throw new Error('path is required');
  }
  const purePath = pure(path);
  const pureRoot = pure(root);
  if (path.startsWith('.')) {
    return pathToFileURL(resolve(pureRoot, purePath)).toString();
  }
  return path;
}

function importFromMain(path, root) {
  return import(resolver(path, root));
}

function importFromMainSafe(path, root) {
  return importFromMain(path, root).catch((error) => {
    if (
      error.code === 'ERR_MODULE_NOT_FOUND' &&
      error.message.endsWith(` imported from ${fileURLToPath(import.meta.url)}`)
    ) {
      return false;
    }
    throw error;
  });
}

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
    } = typeof pkg === 'string'
      ? require(fileURLToPath(resolver(pkg, root)))
      : pkg;

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
      const io = await importFromMain(path, this.root);
      this.hasCommand = true;
      return cli.command(io);
    });
    return this;
  }

  commandSafe(path) {
    this.cli = this.cli.then((cli) =>
      importFromMainSafe(path, this.root).then((mod) => {
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
