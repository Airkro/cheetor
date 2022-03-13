'use strict';

const { createRequire } = require('module');
const { join } = require('path');

exports.requireJson = function requireJson(path, root) {
  return createRequire(root)(path);
};

function importFrom(path, root) {
  const io = path.startsWith('.') ? join(root, path) : path;

  return import(io);
}

exports.importFrom = importFrom;

exports.importFromSafe = function importFromSafe(path, root) {
  return importFrom(path, root).catch((error) => {
    if (
      error.code === 'ERR_MODULE_NOT_FOUND' &&
      error.message.endsWith(` imported from ${__filename}`)
    ) {
      return false;
    }

    throw error;
  });
};
