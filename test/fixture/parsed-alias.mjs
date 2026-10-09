import pkg from '../../package.json' with { type: 'json' };

import { Cheetor } from '../../src/index.mts';

new Cheetor(pkg, import.meta.url)
  .command('deploy', 'Deploy things', (deploy) => {
    deploy.option('-e, --env <env>', 'Target environment');

    deploy.command('rollout <name>', 'Rollout a service', (rollout) => {
      rollout.alias('go').option('-f, --fast', 'Fast rollout');
    });
  })
  .setup((parsed) => {
    console.log(JSON.stringify(parsed));
  });
