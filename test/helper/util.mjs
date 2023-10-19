import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const ExecFile = promisify(execFile);

class RunError extends Error {
  constructor(error) {
    super(error.message);
    this.name = 'RunError';
    this.info = error.message.trim().split(/\r\n|\n/);
  }
}

export function Run(...args) {
  return ExecFile('node', args)
    .then(({ stdout, stderr }) => {
      if (stderr) {
        throw new Error(stderr);
      }

      return stdout.trim().split(/\r\n|\n/);
    })
    .catch((error) => {
      throw new RunError(error);
    });
}
