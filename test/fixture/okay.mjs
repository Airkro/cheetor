import Cheetor from '../../index.cjs';

new Cheetor('../../../package.json', import.meta.url)
  .commandFrom('./data.cjs')
  .command({ command: 'lll', describe: 'describe' })
  .setup();
