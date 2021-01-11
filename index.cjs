const { createRequire } = require('module');
const yargs = require('yargs');
const { green, level } = require('chalk');

const root = (module.parent && module.parent.filename) || require.main.filename;

const requireFromMain = createRequire(root);

function requireFromMainSafe(path) {
  try {
    return requireFromMain(path);
  } catch (error) {
    if (
      error.code === 'MODULE_NOT_FOUND' &&
      error.requireStack &&
      error.requireStack[0] === root
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
  constructor(path = './package.json') {
    const {
      bin,
      homepage,
      name = 'cheetor',
      repository: { url = '' } = {},
      version,
    } = requireFromMain(path);

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

  command(path) {
    this.hasCommand = true;
    this.cli.command(requireFromMain(path));
    return this;
  }

  commandSmart(path) {
    const mod = requireFromMainSafe(path);
    if (mod && mod.command) {
      this.hasCommand = true;
      this.cli.command(mod);
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
