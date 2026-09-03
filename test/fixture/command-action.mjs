import { Cheetor } from '../../src/index.mts';

new Cheetor('../../package.json', import.meta.url)
  .commandFrom('../command.mjs')
  .setup();
