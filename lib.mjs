import { createRequire } from 'module';
import { join } from 'path';
import { fileURLToPath } from 'url';

export function requireJson(path, root) {
  return createRequire(root)(path);
}

export function importFrom(path, root) {
  const io = path.startsWith('.') ? join(root, path) : path;
  return import(io);
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
