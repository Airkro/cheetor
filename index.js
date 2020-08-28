const yargs = require('yargs');
const { green } = require('chalk');

function requireFromMain(id) {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  return require(require.resolve(id, { paths: [require.main.path] }));
}

function findCmd(cmd) {
  try {
    return requireFromMain(cmd);
  } catch {
    return { command: '' };
  }
}

module.exports = class Cheetor {
  constructor(path = './package.json') {
    const {
      version,
      bin = {},
      homepage,
      repository: { url } = {},
    } = requireFromMain(path);

    const repository = url.replace(/\.git$/, '');
    const hasWebsite = homepage && homepage !== repository;

    [this.scriptName] = Object.keys(bin);

    this.cli = yargs
      .strict()
      .alias('help', 'h')
      .alias('version', 'v')
      .hide('help')
      .version(version)
      .hide('version')
      .detectLocale(false)
      .epilogue(`Repository: ${repository}`)
      .epilogue(hasWebsite ? `Website: ${homepage}` : '\u001B[0m')
      .epilogue(hasWebsite ? '\u001B[0m' : '')
      .scriptName(this.scriptName)
      .usage('');
  }

  config(func) {
    func(this.cli);
    return this;
  }

  command(path) {
    this.hasCommand = true;
    this.cli.command(findCmd(path));
    return this;
  }

  ready() {
    if (this.hasCommand) {
      this.cli.usage(`Usage: ${green('$0')} <command>`);
    } else {
      this.cli.usage(`Usage: ${green('$0')}`);
    }
  }

  setup(action) {
    this.ready();

    if (typeof action === 'function') {
      process.title = this.scriptName;

      action(this.cli.argv);
    } else {
      if (this.hasCommand) {
        this.cli.demandCommand(1, "Won't work without a command");
      }

      process.title = this.scriptName;

      // eslint-disable-next-line no-unused-expressions
      this.cli.argv;
    }
  }
};
