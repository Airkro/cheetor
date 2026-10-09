import pkg from '../../package.json' with { type: 'json' };

import { Cheetor } from '../../src/index.mts';

await new Cheetor(pkg, import.meta.url)
  .command('greet <name>', 'Greet someone', (greet) => {
    greet.option('-p, --loud', 'Loudly');
  })
  .setup((parsed) => {
    console.log(JSON.stringify(parsed));
  });
