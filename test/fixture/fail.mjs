import pkg from '../../package.json' with { type: 'json' };

import { Cheetor } from '../../src/index.mts';

new Cheetor(pkg, import.meta.url)
  .commandSafe('../error.js')
  .setup()
  .catch((error) => {
    console.error(error.message);
  });

new Cheetor(pkg, import.meta.url)
  .commandFrom('../error.js')
  .setup()
  .catch((error) => {
    console.error(error.message);
  });

new Cheetor(pkg)
  .commandSmart(() => {
    throw new Error('789');
  })
  .setup()
  .catch((error) => {
    console.error(error.message);
  });
