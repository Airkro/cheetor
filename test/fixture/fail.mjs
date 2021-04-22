import Cheetor from '../../index.cjs';

new Cheetor('../../package.json')
  .commandFrom('./data.cjs')
  .command({ command: 'lll', describe: 'describe' })
  .setup();
