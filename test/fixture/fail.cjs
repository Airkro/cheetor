const Cheetor = require('../../index.cjs');

new Cheetor('../../package.json', __dirname).commandSafe('./error.cjs').setup();
