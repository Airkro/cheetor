import test from 'ava';

import { pkg, Run } from './helper/util.cjs';

test('base', async (t) => {
  const stdout = await Run('./test/fixture/base.mjs');
  t.deepEqual(stdout, ['']);
});

test('help', async (t) => {
  const stdout = await Run('./test/fixture/base.mjs', '-h');
  t.deepEqual(stdout, [
    `Usage: ${pkg.name}`,
    '',
    `Website: ${pkg.homepage}`,
    `Repository: ${pkg.repository.url.replace(/\.git$/, '')}`,
  ]);
});

test('deep', async (t) => {
  const stdout = await Run('./test/fixture/deep.mjs');
  t.deepEqual(stdout, ['']);
});

test('okay', async (t) => {
  const stdout = await Run('./test/fixture/okay.mjs');
  t.deepEqual(stdout, ['']);
});

test('fail', async (t) => {
  await Run('./test/fixture/fail.mjs')
    .then(() => {
      t.fail('should fail');
    })
    .catch((error) => {
      t.is(error.info[5], 'Error: 456');
    });
});
