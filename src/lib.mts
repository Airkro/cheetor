import { fileURLToPath } from 'node:url';

export function importFrom(path: string, root = ''): Promise<any> {
  const io = path.startsWith('.') ? new URL(path, `${root}/`).href : path;

  return import(/* webpackIgnore: true */ io);
}

export function importFromSafe(
  path: string,
  root: string,
): Promise<any | false> {
  return importFrom(path, root).catch((error: unknown) => {
    const cause = error as { code?: string; message?: string };

    if (
      cause.code === 'ERR_MODULE_NOT_FOUND' &&
      cause.message?.endsWith(
        ` imported from ${fileURLToPath(import.meta.url)}`,
      )
    ) {
      return false;
    }

    throw error;
  });
}
