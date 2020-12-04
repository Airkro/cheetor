const { resolve } = require('path');
const yargs = require('yargs');
const { green, level } = require('chalk');

function requireFromMain(moduleId) {
  /* eslint-disable global-require, import/no-dynamic-require */
  if (moduleId.startsWith('./')) {
    return require(resolve(require.main.path, moduleId));
  }

  return require(moduleId);
  /* eslint-enable global-require, import/no-dynamic-require */
}

function findCmd(path) {
  try {
    return requireFromMain(path);
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      return undefined;
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

  this.cli
    .epilogue(hasWebsite ? `Website: ${site}` : '\u001B[0m')
    .epilogue(hasWebsite ? '\u001B[0m' : '');
}

module.exports = class Cheetor {
  constructor(path = './package.json') {
    const {
      name,
      version,
      bin = {},
      homepage,
      repository: { url } = {},
    } = requireFromMain(path);

    this.repository = url.replace(/\.git$/, '');
    this.homepage = homepage;
    this.scriptName = typeof bin === 'string' ? name : Object.keys(bin)[0];

    this.cli = yargs
      .strict()
      .alias('help', 'h')
      .alias('version', 'v')
      .hide('help')
      .version(version)
      .hide('version')
      .detectLocale(false)
      .epilogue(`Repository: ${this.repository}`)
      .scriptName(this.scriptName)
      .usage('')
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
    const mod = findCmd(path);
    if (mod) {
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
