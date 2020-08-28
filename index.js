const yargs = require('yargs');
const { green, level } = require('chalk');

function requireFromMain(id) {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  return require(require.resolve(id, { paths: [require.main.path] }));
}

function findCmd(path) {
  try {
    return requireFromMain(path);
  } catch {
    return { command: '' };
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
      version,
      bin = {},
      homepage,
      repository: { url } = {},
    } = requireFromMain(path);

    this.repository = url.replace(/\.git$/, '');
    this.homepage = homepage;
    // eslint-disable-next-line prefer-destructuring
    this.scriptName = Object.keys(bin)[0];

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
        hide: true,
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
    this.hasCommand = true;
    this.cli.command(findCmd(path));
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
