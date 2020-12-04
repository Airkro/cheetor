const test = require('ava').default;

const { exec } = require('child_process');

const pkg = require('../package.json');

function testCmd(name, command, checker) {
  test.cb(name, (t) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        t.fail(error.message);
      }

      if (stderr) {
        t.fail(stderr);
      }

      if (stdout) {
        t.log(stdout);

        if (checker) {
          checker(t, stdout.trim().split('\n'));
        }
      }

      t.end();
    });
  });
}

testCmd('base', 'node ./test/fixture/sample.js');

testCmd('help', 'node ./test/fixture/sample.js -h', (t, stdout) => {
  t.deepEqual(stdout, [
    `Usage: ${pkg.name}`,
    '',
    `Website: ${pkg.homepage}`,
    `Repository: ${pkg.repository.url.replace(/\.git$/, '')}`,
  ]);
});
