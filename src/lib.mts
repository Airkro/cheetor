function resolve(path: string, root = ''): string {
  return path.startsWith('.') ? new URL(path, `${root}/`).href : path;
}

export async function importFrom<T>(path: string, root = ''): Promise<T> {
  const module = await import(/* webpackIgnore: true */ resolve(path, root));

  return module as T;
}

export async function importFromSafe<T>(
  path: string,
  root: string,
): Promise<T | false> {
  const io = resolve(path, root);

  try {
    return await importFrom<T>(path, root);
  } catch (error: unknown) {
    const cause = error as { code?: string; message?: string };

    if (cause.code === 'ERR_MODULE_NOT_FOUND' && cause.message?.includes(io)) {
      return false;
    }

    throw error;
  }
}
