import pkg from '../../../package.json' with { type: 'json' };

import { Cheetor } from '../../../src/index.mts';

new Cheetor(pkg).setup();
