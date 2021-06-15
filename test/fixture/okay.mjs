import { Cheetor } from '../../index.mjs';

new Cheetor('../../../package.json', import.meta.url)
  .command('static', 'command static')
  .commandSafe('qss')
  .commandFrom('../command.mjs')
  .commandSmart(() => ({ command: 'smart', describe: 'command smart' }))
  .commandSmart(() => {})
  .setup();
