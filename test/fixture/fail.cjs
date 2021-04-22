const Cheetor = require('../../index.cjs');

new Cheetor('../../package.json').commandSafe('./error.cjs').setup();
