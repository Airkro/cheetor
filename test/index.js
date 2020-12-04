const test = require('ava').default;

const { exec } = require('child_process');

const pkg = require('../package.json');

function testCmdPass(name, command, checker) {
  test.cb(name, (t) => {
    exec(command, (error, stdout) => {
      if (error) {
        t.fail("shouldn't fail");
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
        checker(t, stderr);
      }

      t.end();
    });
  });
}

testCmdPass('base', 'node ./test/fixture/base.js', (t, stdout) => {
  t.deepEqual(stdout, ['']);
});

testCmdPass('help', 'node ./test/fixture/base.js -h', (t, stdout) => {
  t.deepEqual(stdout, [
    `Usage: ${pkg.name}`,
    '',
    `Website: ${pkg.homepage}`,
    `Repository: ${pkg.repository.url.replace(/\.git$/, '')}`,
  ]);
});

testCmdPass('success', 'node ./test/fixture/success.js', (t, stdout) => {
  t.deepEqual(stdout, ['']);
});

testCmdFail('fail', 'node ./test/fixture/fail.js', (t, stderr) => {
  t.not(stderr, '');
});
