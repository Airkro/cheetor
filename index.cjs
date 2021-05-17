const yargs = require('yargs');
const { green, level } = require('chalk');
const { fileURLToPath } = require('url');
const { isAbsolute, resolve } = require('path');

function pure(path) {
  return path.startsWith('file:') ? fileURLToPath(path) : path;
}

function resolver(path, root) {
  const purePath = pure(path);
  const pureRoot = pure(root);
  if (isAbsolute(purePath)) {
    return purePath;
  }
  if (path.startsWith('~')) {
    return require.resolve(path.replace(/^~/, ''));
  }
  return resolve(pureRoot, purePath);
}

function requireFromMain(path, root) {
  return require(resolver(path, root));
}

function requireFromMainSafe(path, root) {
  try {
    return requireFromMain(path, root);
  } catch (error) {
    if (
      error.code === 'MODULE_NOT_FOUND' &&
      error.requireStack &&
      error.requireStack[0] === __filename
    ) {
      // eslint-disable-next-line consistent-return
      return;
    }
    throw error;
  }
}

function ready() {
  const { hasCommand, homepage, site = homepage, repository } = this;

  const hasWebsite = site && site !== repository;

  if (hasCommand) {
    this.cli.usage(`Usage: ${green('$0')} <command>`);
  } else {
    this.cli.usage(`Usage: ${green('$0')}`);
  }

  if (hasWebsite) {
    this.cli.epilogue(`Website: ${site}`);
  }

  if (repository) {
    this.cli.epilogue(`Repository: ${repository}`);
  }
}

module.exports = class Cheetor {
  constructor(pkg = './package.json', root) {
    if (!root) {
      throw new Error('root is required');
    }

    const {
      bin,
      homepage,
      name = 'cheetor',
      repository: { url = '' } = {},
      version,
    } = typeof pkg === 'string' ? requireFromMain(pkg, root) : pkg;

    this.root = root;

    this.repository = url.includes('github.com')
      ? url.replace(/\.git$/, '')
      : '';
    this.homepage = homepage;
    this.scriptName = ['string', 'undefined'].includes(typeof bin)
      ? name
      : Object.keys(bin)[0];

    this.cli = yargs
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
      });
  }

  config(func) {
    func(this.cli);
    return this;
  }

  command(...args) {
    this.cli.command(...args);
    this.hasCommand = true;
    return this;
  }

  commandFrom(path) {
    const io = requireFromMain(path, this.root);
    this.cli.command(io);
    this.hasCommand = true;
    return this;
  }

  commandSafe(path) {
    const mod = requireFromMainSafe(path, this.root);
    if (mod && mod.command) {
      this.cli.command(mod);
      this.hasCommand = true;
    }
    return this;
  }

  commandSmart(func) {
    const mod = func();
    if (mod && mod.command) {
      this.cli.command(mod);
      this.hasCommand = true;
    }
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
    this.cli.middleware(...args);
    return this;
  }

  setup(action) {
    ready.bind(this)();

    if (typeof action === 'function') {
      action(this.cli.argv);
    } else {
      if (this.hasCommand) {
        this.cli.demandCommand(1, "Won't work without a command");
      }
      // eslint-disable-next-line no-unused-expressions
      this.cli.argv;
    }
  }
};
