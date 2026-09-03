function resolve(path: string, root = ''): string {
  return path.startsWith('.') ? new URL(path, `${root}/`).href : path;
}

export async function importFrom<T>(path: string, root = ''): Promise<T> {
  return import(/* webpackIgnore: true */ resolve(path, root));
}

export async function importFromSafe<T>(
  path: string,
  root: string,
): Promise<T | false> {
  const io = resolve(path, root);

  try {
    return await importFrom<T>(path, root);
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'ERR_MODULE_NOT_FOUND' &&
      error.message.includes(io)
    ) {
      return false;
    }

    throw error;
  }
}
