const { promisify } = require('util');
const { execFile } = require('child_process');

const ExecFile = promisify(execFile);

const pkg = require('../../package.json');

class RunError extends Error {
  constructor(error) {
    super(error.message);
    this.info = error.message.trim().split(/\r\n|\n/);
  }
}

function Run(...args) {
  return ExecFile('node', args)
    .then(({ stdout }) => stdout.trim().split(/\r\n|\n/))
    .catch((error) => {
      throw new RunError(error);
    });
}

module.exports = { Run, pkg };
