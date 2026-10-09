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
import { readFileSync } from 'node:fs';
import { Cheetor } from 'cheetor';

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);

new Cheetor(pkg).setup();
```

## Commands

`command()` registers a top-level command. `cheetor` builds on
[`commander`](https://github.com/tj/commander.js), which matches a real command
tree, so subcommands nest directly with no folding. Declare the tree with a
builder callback (yargs-style): `command()` always returns the `Cheetor`
instance, and each level receives its own node to configure.

```mjs
new Cheetor(pkg, new URL('./', import.meta.url))
  .command('deploy', 'Deploy things', (deploy) => {
    deploy.option('-e, --env <env>', 'Target environment');

    deploy.command('rollout <name>', 'Rollout a service', (rollout) => {
      rollout.option('-f, --fast', 'Fast rollout').action((name, options) => {
        console.log(`env=${options.env} name=${name} fast=${options.fast}`);
      });
    });
  })
  .setup();
```

```bash
$ mycli deploy rollout api --env prod --fast
env=prod name=api fast=true
```

A parent's option can be passed after a subcommand token (note `--env prod`
above) and is read through Commander's merged option view.

Running a node that only has children (no action) prints them:

```bash
$ mycli deploy
Available subcommands: rollout
```

That same parent's `-h` lists its subcommands under a `Commands:` section.

### Nodes

Every node inside a builder callback exposes:

- `command(name, description?, builder?)` — add a child. `name` may carry positionals, e.g. `rollout <name>` or `rm [file]`.
- `option(name, description?, config?)` — add an option, declared on this node only. Descendants reach an ancestor's option through Commander's option
  inheritance (`optsWithGlobals()`): an explicitly passed value applies where it
  is read, while a flag that is not set resolves to the shallowest ancestor that
  declares a default.
- `action(fn)` — set the handler, called as `fn(...positionals, options)`.
- `alias(name)` — an alternate name that routes to this command.
- `description(text)` — set or change the description.

`config` is `{ default }` — it sets the option's default value.

## Command modules

A command can also be registered from a module object, or loaded from a file path.

```ts
type Module = {
  command?: string;
  describe?: string;
  options?: Array<[name: string, description: string, config?: object]>;
  action?: (...args: unknown[]) => unknown;
};
```

| Method               | Behaviour                                                                           |
| -------------------- | ----------------------------------------------------------------------------------- |
| `command(module)`    | Register a `Module` object passed inline.                                           |
| `commandFrom(path)`  | Import the module at `path` and register it. Throws if missing.                     |
| `commandSafe(path)`  | Like `commandFrom`, but silently skips the command when the module cannot be found. |
| `commandSmart(func)` | Register whatever `func()` returns; no-op when it returns `undefined`.              |

`path` is resolved against the second constructor argument (`root`), which **must be a
directory URL**. Use `new URL('./', import.meta.url)` — not a bare `import.meta.url` (that is
the entry _file_, so a `./` path would resolve beneath it and fail).

```mjs
new Cheetor(pkg, new URL('./', import.meta.url))
  .command({
    command: 'build',
    describe: 'Build the project',
    action: () => {}
  })
  .commandFrom('./commands/serve.mjs')
  .commandSafe('./commands/optional.mjs')
  .commandSmart(() =>
    process.env.SECRET
      ? { command: 'secret', describe: 'Secret command', action: () => {} }
      : undefined
  )
  .setup();
```

## Setup

`setup()` finalizes registration and parses `process.argv`. Pass an action to run instead of the
default parse result:

```mjs
await new Cheetor(pkg, new URL('./', import.meta.url)).setup((parsed) => {
  console.log(parsed);
});
```
