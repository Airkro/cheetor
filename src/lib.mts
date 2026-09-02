function resolve(path: string, root = ''): string {
  return path.startsWith('.') ? new URL(path, `${root}/`).href : path;
}

export function importFrom(path: string, root = ''): Promise<any> {
  return import(/* webpackIgnore: true */ resolve(path, root));
}

export function importFromSafe(
  path: string,
  root: string,
): Promise<any | false> {
  const io = resolve(path, root);

  return importFrom(path, root).catch((error: unknown) => {
    const cause = error as { code?: string; message?: string };

    if (cause.code === 'ERR_MODULE_NOT_FOUND' && cause.message?.includes(io)) {
      return false;
    }

    throw error;
  });
}
