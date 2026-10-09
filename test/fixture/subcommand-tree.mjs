import pkg from '../../package.json' with { type: 'json' };

import { Cheetor } from '../../src/index.mts';

new Cheetor(pkg, import.meta.url)
  .command('a', 'Level A', (a) => {
    a.option('-m, --mode <mode>', 'Mode', { default: 'parent' });
    a.option('-s, --shared <value>', 'Shared at A', { default: 'from-a' });

    a.command('b', 'Level B', (b) => {
      // Same flag re-declared at B. Commander keeps both declarations; at a
      // descendant read via optsWithGlobals() the shallowest (a's) default wins
      // when the flag is not passed explicitly.
      b.option('-s, --shared <value>', 'Shared at B', {
        default: 'from-b',
      });

      b.command('c <name>', 'Level C', (c) => {
        c.action((name, options) => {
          console.log(
            `name=${name} mode=${options.mode} shared=${options.shared}`,
          );
        });
      });
    });
  })
  .setup();
