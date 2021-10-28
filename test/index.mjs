import { createRequire } from 'module';

// eslint-disable-next-line import/no-unresolved
import test from 'ava';

import { Run } from './helper/util.mjs';

const pkg = createRequire(import.meta.url)('../package.json');

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
  const stdout = await Run('./test/fixture/okay.mjs', '-h');
  t.deepEqual(
    [
      `Usage: ${pkg.name} <command>`,
      '',
      'Commands:',
      '  cheetor static  command static',
      '  cheetor test    command test',
      '  cheetor smart   command smart',
      '',
      `Website: ${pkg.homepage}`,
      `Repository: ${pkg.repository.url.replace(/\.git$/, '')}`,
    ],
    stdout,
  );
});

test('fail', async (t) => {
  await Run('./test/fixture/fail.mjs')
    .then(() => {
      t.fail('should fail');
    })
    .catch((error) => {
      t.deepEqual(error.info, ['789', '456', '456']);
    });
});
