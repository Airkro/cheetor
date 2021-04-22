# cheetor

Build interactive command line tools.

[![npm][npm-badge]][npm-url]
[![github][github-badge]][github-url]
![node][node-badge]

[npm-url]: https://www.npmjs.com/package/cheetor
[npm-badge]: https://img.shields.io/npm/v/cheetor.svg?style=flat-square&logo=npm
[github-url]: https://github.com/airkro/cheetor
[github-badge]: https://img.shields.io/npm/l/cheetor.svg?style=flat-square&colorB=blue&logo=github
[node-badge]: https://img.shields.io/node/v/cheetor.svg?style=flat-square&colorB=green&logo=node.js

## Installation

```bash
npm install cheetor --save
```

## Usage

```mjs
// esmodules
import Cheetor from 'cheetor';

new Cheetor('./package.json', import.meta.url).setup();
```

```cjs
// commonjs
const Cheetor = require('cheetor');

new Cheetor('./package.json').setup();
```
