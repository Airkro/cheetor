import pkg from '../../package.json' with { type: 'json' };

import { Cheetor } from '../../src/index.mts';

new Cheetor(pkg, import.meta.url)
  .subcommand('deploy', 'Deploy things')
  .option('-e, --env <env>', 'Target environment')
  .command('rollout <name>', 'Rollout a service')
  .option('-f, --fast', 'Fast rollout')
  .action((name, options) => {
    console.log(`env=${options.env} name=${name} fast=${options.fast}`);
  })
  .setup();
