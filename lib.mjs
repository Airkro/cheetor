import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function importFrom(path, root) {
  const io = path.startsWith('.') ? join(root, path) : path;

  return import(/* webpackIgnore: true */ io);
}

export function importFromSafe(path, root) {
  return importFrom(path, root).catch((error) => {
    if (
      error.code === 'ERR_MODULE_NOT_FOUND' &&
      error.message.endsWith(` imported from ${fileURLToPath(import.meta.url)}`)
    ) {
      return false;
    }

    throw error;
  });
}
