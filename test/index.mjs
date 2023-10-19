import test from 'ava';

import { Run } from './helper/util.mjs';

test('base', async (t) => {
  const stdout = await Run('./test/fixture/base.mjs');
  t.snapshot(stdout);
});

test('help', async (t) => {
  const stdout = await Run('./test/fixture/base.mjs', '-h');
  t.snapshot(stdout);
});

test('deep', async (t) => {
  const stdout = await Run('./test/fixture/deep.mjs');
  t.snapshot(stdout);
});

test('okay', async (t) => {
  const stdout = await Run('./test/fixture/okay.mjs', '-h');
  t.snapshot(stdout);
});

test('fail', async (t) => {
  await Run('./test/fixture/fail.mjs')
    .then(() => {
      t.fail('should fail');
    })
    .catch((error) => {
      t.snapshot(error.info);
    });
});
