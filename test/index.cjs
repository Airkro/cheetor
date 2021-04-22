const test = require('ava').default;

const { EOL } = require('os');
const { exec } = require('child_process');

const pkg = require('../package.json');

function testCmdPass(name, command, checker) {
  test.cb(name, (t) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        t.fail("shouldn't fail");
      }

      if (stderr) {
        t.log(stderr);
      }

      if (stdout) {
        t.log(stdout);
      }

      if (checker) {
        checker(t, stdout.trim().split('\n'));
      }

      t.end();
    });
  });
}

function testCmdFail(name, command, checker) {
  test.cb(name, (t) => {
    exec(command, (error, stdout, stderr) => {
      if (!error) {
        t.fail('should fail');
      }

      if (stdout) {
        t.log(stdout);
      }

      if (checker) {
        checker(t, stderr.trim().split(EOL));
      }

      t.end();
    });
  });
}

testCmdPass('base', 'node ./test/fixture/base.cjs', (t, stdout) => {
  t.deepEqual(stdout, ['']);
});

testCmdPass('help', 'node ./test/fixture/base.cjs -h', (t, stdout) => {
  t.deepEqual(stdout, [
    `Usage: ${pkg.name}`,
    '',
    `Website: ${pkg.homepage}`,
    `Repository: ${pkg.repository.url.replace(/\.git$/, '')}`,
  ]);
});

testCmdPass('success', 'node ./test/fixture/success.cjs', (t, stdout) => {
  t.deepEqual(stdout, ['']);
});

testCmdFail('fail', 'node ./test/fixture/fail.cjs', (t, stderr) => {
  t.is(stderr[4], `Error: 456`);
});

testCmdPass('deep', 'node ./test/fixture/deep.cjs', (t, stdout) => {
  t.deepEqual(stdout, ['']);
});
