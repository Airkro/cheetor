import { Cheetor } from '../../index.cjs';

new Cheetor('../../../package.json', import.meta.url)
  .commandSafe('../error.cjs')
  .setup();
