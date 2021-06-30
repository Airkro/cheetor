import { join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createRequire } from 'module';

export function resolver(path, root) {
  if (path.startsWith('.')) {
    return join(root, path);
  }
  return path;
}

export function requireJson(path, root) {
  return createRequire(root)(path);
}

export function importFrom(path, root) {
  const io = resolver(path, root);
  return import(io.startsWith('file:') ? io : pathToFileURL(io));
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
