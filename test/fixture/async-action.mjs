import pkg from '../../package.json' with { type: 'json' };

import { Cheetor } from '../../src/index.mts';

await new Cheetor(pkg, import.meta.url)
  .command('slow', 'Async action', (slow) => {
    slow.action(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });
      console.log('inside action');
    });
  })
  .setup();

console.log('after setup');
