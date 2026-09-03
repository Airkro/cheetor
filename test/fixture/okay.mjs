import pkg from '../../package.json' with { type: 'json' };

import { Cheetor } from '../../src/index.mts';

new Cheetor(pkg, import.meta.url)
  .command('static', 'command static')
  .commandSafe('qss')
  .commandFrom('../command.mjs')
  .commandSmart(() => ({ command: 'smart', describe: 'command smart' }))
  .commandSmart(() => {})
  .setup();
