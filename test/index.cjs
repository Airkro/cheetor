const test = require('ava');

const { Run, pkg } = require('./helper/util.cjs');

test('base', async (t) => {
  const stdout = await Run('./test/fixture/base.cjs');
  t.deepEqual(stdout, ['']);
});

test('help', async (t) => {
  const stdout = await Run('./test/fixture/base.cjs', '-h');
  t.deepEqual(stdout, [
    `Usage: ${pkg.name}`,
    '',
    `Website: ${pkg.homepage}`,
    `Repository: ${pkg.repository.url.replace(/\.git$/, '')}`,
  ]);
});

test('success', async (t) => {
  const stdout = await Run('./test/fixture/okay.cjs');
  t.deepEqual(stdout, ['']);
});

test('fail', async (t) => {
  const errorInfo = await Run('./test/fixture/fail.cjs').catch(
    (error) => error.info,
  );
  t.is(errorInfo[5], 'Error: 456');
});

test('deep', async (t) => {
  const stdout = await Run('./test/fixture/deep.cjs');
  t.deepEqual(stdout, ['']);
});
