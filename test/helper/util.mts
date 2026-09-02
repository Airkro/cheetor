import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

class RunError extends Error {
  info: string[];

  constructor(error: { message: string }) {
    super(error.message);
    this.name = 'RunError';
    this.info = error.message.trim().split(/\r\n|\n/);
  }
}

export function Run(...args: string[]): Promise<string[]> {
  return exec('node', args)
    .then(({ stdout, stderr }) => {
      if (stderr) {
        throw new Error(stderr);
      }

      return stdout.trim().split(/\r\n|\n/);
    })
    .catch((error: { message: string }) => {
      throw new RunError(error);
    });
}
