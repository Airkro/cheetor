import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { importFrom, importFromSafe } from '../src/lib.mts';
import type { Module, OptionSpec, Parsed, Pkg } from '../src/index.mts';
import { Cheetor } from '../src/index.mts';

import { Run } from './helper/util.mts';

const pkgData = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

interface FakeOption {
  flags: string;
  description: string;
  defaultValue?: unknown;
  default(value: unknown): FakeOption;
}

interface FakeHelpText {
  position: string;
  text: string;
}

interface FakeCommand {
  _name: string;
  descriptionText: string;
  usageText: string;
  versionValue: string | undefined;
  helpOptionSet: { flags: string; description: string } | undefined;
  helpTexts: FakeHelpText[];
  commands: FakeCommand[];
  options: FakeOption[];
  _aliasList: string[];
  actionCalls: unknown[];
  positionalEnabled: boolean;
  parsedArgv: string[] | undefined;
  args: string[];
  name(value?: string): string | FakeCommand;
  description(text: string): FakeCommand;
  usage(text: string): FakeCommand;
  version(v: string, flags?: string, description?: string): FakeCommand;
  helpOption(flags: string, description?: string): FakeCommand;
  addHelpText(position: string, text: string): FakeCommand;
  command(nameAndArgs: string): FakeCommand;
  addCommand(cmd: FakeCommand): FakeCommand;
  createOption(flags: string, description?: string): FakeOption;
  addOption(opt: FakeOption): FakeCommand;
  option(
    flags: string,
    description?: string,
    defaultValue?: unknown,
  ): FakeCommand;
  action(fn: unknown): FakeCommand;
  alias(a: string): FakeCommand;
  aliases(): string[];
  enablePositionalOptions(): FakeCommand;
  opts(): Record<string, unknown>;
  optsWithGlobals(): Record<string, unknown>;
  parse(argv: string[]): FakeCommand;
  parseAsync(argv: string[]): Promise<FakeCommand>;
}

function makeOption(flags: string, description = ''): FakeOption {
  const option: FakeOption = {
    flags,
    description,
    default(value: unknown) {
      option.defaultValue = value;
      return option;
    },
  };
  return option;
}

const h = vi.hoisted(() => {
  const created: FakeCommand[] = [];

  function make(name?: string): FakeCommand {
    const cmd: FakeCommand = {
      _name: name ?? '',
      descriptionText: '',
      usageText: '[options] [command]',
      versionValue: undefined,
      helpOptionSet: undefined,
      helpTexts: [],
      commands: [],
      options: [],
      _aliasList: [],
      actionCalls: [],
      positionalEnabled: false,
      parsedArgv: undefined,
      args: [],
      name(value?: string) {
        if (value === undefined) {
          return cmd._name;
        }
        cmd._name = value;
        return cmd;
      },
      description(text: string) {
        cmd.descriptionText = text;
        return cmd;
      },
      usage(text: string) {
        cmd.usageText = text;
        return cmd;
      },
      version(v: string) {
        cmd.versionValue = v;
        return cmd;
      },
      helpOption(flags: string, description = '') {
        cmd.helpOptionSet = { flags, description };
        return cmd;
      },
      addHelpText(position: string, text: string) {
        cmd.helpTexts.push({ position, text });
        return cmd;
      },
      command(nameAndArgs: string) {
        const child = make(nameAndArgs.split(/\s+/, 1)[0] ?? '');
        cmd.commands.push(child);
        return child;
      },
      addCommand(child: FakeCommand) {
        cmd.commands.push(child);
        return cmd;
      },
      createOption(flags: string, description?: string) {
        return makeOption(flags, description);
      },
      addOption(option: FakeOption) {
        cmd.options.push(option);
        return cmd;
      },
      option(flags: string, description?: string, defaultValue?: unknown) {
        const option = makeOption(flags, description);
        if (defaultValue !== undefined) {
          option.defaultValue = defaultValue;
        }
        cmd.options.push(option);
        return cmd;
      },
      action(fn: unknown) {
        cmd.actionCalls.push(fn);
        return cmd;
      },
      alias(a: string) {
        cmd._aliasList.push(a);
        return cmd;
      },
      aliases() {
        return cmd._aliasList;
      },
      enablePositionalOptions() {
        cmd.positionalEnabled = true;
        return cmd;
      },
      opts() {
        return {};
      },
      optsWithGlobals() {
        return {};
      },
      parse(argv: string[]) {
        cmd.parsedArgv = argv;
        return cmd;
      },
      parseAsync(argv: string[]) {
        cmd.parsedArgv = argv;
        return Promise.resolve(cmd);
      },
    };

    created.push(cmd);
    return cmd;
  }

  return { created, make };
});

vi.mock('commander', () => ({
  // `make` is a plain function declaration, so `new Command(name)` constructs
  // the fake (a function returning an object yields that object).
  Command: h.make,
  program: h.make(),
}));

const FIXTURE = new URL('./fixture/', import.meta.url).href;

function makeCheetor(
  pkg: ConstructorParameters<typeof Cheetor>[0],
  root: ConstructorParameters<typeof Cheetor>[1] = import.meta.url,
) {
  const c = new Cheetor(pkg, root);
  const cli = h.created.at(-1);
  if (!cli) {
    throw new Error('no fake cli was created');
  }
  return { c, cli };
}

function findChild(
  cmd: FakeCommand | undefined,
  name: string,
): FakeCommand | undefined {
  return cmd?.commands.find((entry) => entry._name === name);
}

function command(child: FakeCommand | undefined): FakeCommand {
  if (!child) {
    throw new Error('expected a command to be registered');
  }
  return child;
}

function optionFlags(cmd: FakeCommand): string[] {
  return cmd.options.map((option) => option.flags);
}

describe('lib', () => {
  it('importFrom with relative path', async () => {
    const mod = await importFrom<{ command: string; describe: string }>(
      './command.mjs',
      FIXTURE,
    );
    expect(mod.command).toMatchSnapshot();
  });

  it('importFrom with bare path', async () => {
    const mod = await importFrom<typeof import('node:path')>('node:path');
    expect(typeof mod.join).toMatchSnapshot();
  });

  it('importFromSafe success', async () => {
    const mod = await importFromSafe<{ command: string; describe: string }>(
      './command.mjs',
      FIXTURE,
    );
    expect(mod).toMatchSnapshot();
  });

  it('importFromSafe returns false on missing module', async () => {
    const result = await importFromSafe('./__missing__.mjs', FIXTURE);
    expect(result).toMatchSnapshot();
  });

  it('importFromSafe rethrows non-module errors', async () => {
    await expect(importFromSafe('./throws.mjs', FIXTURE)).rejects.toThrow(
      'boom',
    );
  });
});

describe('Cheetor constructor', () => {
  it('extracts metadata from pkg object', () => {
    const { c } = makeCheetor(pkgData);
    expect(c.homepage).toMatchSnapshot();
    expect(c.repository).toMatchSnapshot();
  });

  it('ignores non-github repository and defaults name', () => {
    const { c, cli } = makeCheetor({
      homepage: 'https://example.com',
      repository: { url: 'https://example.com/x.git' },
    });
    expect(c.repository).toMatchSnapshot();
    expect(c.homepage).toMatchSnapshot();
    expect(cli.name()).toMatchSnapshot();
  });

  it('accepts a string-form github repository', () => {
    const { c } = makeCheetor({
      repository: 'git+https://github.com/a/b.git',
    });
    expect(c.repository).toMatchSnapshot();
  });

  it('uses pkg name when bin is a string', () => {
    const { cli } = makeCheetor({ name: 'mypkg', bin: 'bin.js' });
    expect(cli.name()).toMatchSnapshot();
  });

  it('uses single bin key when bin is a single-key object', () => {
    const { cli } = makeCheetor({ name: 'mypkg', bin: { one: 'x' } });
    expect(cli.name()).toMatchSnapshot();
  });

  it('uses pkg name when bin object has many keys', () => {
    const { cli } = makeCheetor({
      name: 'mypkg',
      bin: { one: 'x', two: 'y' },
    });
    expect(cli.name()).toMatchSnapshot();
  });

  it('sets version when provided', () => {
    const { cli } = makeCheetor({ name: 'mypkg', version: '1.2.3' });
    expect(cli.versionValue).toMatchSnapshot();
  });

  it('does not set version when not provided', () => {
    const { cli } = makeCheetor({ name: 'mypkg' });
    expect(cli.versionValue).toMatchSnapshot();
  });
});

describe('Cheetor methods', () => {
  it('config calls the function with the cli', async () => {
    const { c, cli } = makeCheetor({ name: 'test' });
    const originalArgv = process.argv;
    process.argv = ['node', 'cheetor', 'serve', '--fast'];
    let receivedName = '';
    c.config((entry) => {
      receivedName = entry.name() as string;
      return entry;
    });
    try {
      await c.setup();
    } finally {
      process.argv = originalArgv;
    }
    expect(receivedName).toMatchSnapshot();
    expect(cli.parsedArgv).toMatchSnapshot();
  });

  it('command registers with string name and description', async () => {
    const { c, cli } = makeCheetor({ name: 'test' });
    c.command('static', 'description');
    await c.setup();
    const staticCommand = command(findChild(cli, 'static'));
    expect(staticCommand._name).toMatchSnapshot();
    expect(staticCommand.descriptionText).toMatchSnapshot();
  });

  it('command registers nested subcommands', async () => {
    const { c, cli } = makeCheetor({ name: 'test' });
    c.command('deploy', 'Deploy things', (deploy) => {
      deploy.option('-e, --env <env>', 'Target environment');
      deploy.command('rollout <name>', 'Rollout a service');
    });
    await c.setup();
    const deploy = command(findChild(cli, 'deploy'));
    const rollout = command(findChild(deploy, 'rollout'));
    expect(deploy.descriptionText).toMatchSnapshot();
    expect(rollout._name).toMatchSnapshot();
  });

  it('command registers with module object', async () => {
    const { c, cli } = makeCheetor({ name: 'test' });
    c.command({ command: 'test', describe: 'command test' });
    await c.setup();
    const testCommand = command(findChild(cli, 'test'));
    expect(testCommand._name).toMatchSnapshot();
    expect(testCommand.descriptionText).toMatchSnapshot();
  });

  it('command registers module options and action', async () => {
    const { c, cli } = makeCheetor({ name: 'test' });
    const action = vi.fn();
    c.command({
      command: 'build',
      describe: 'command build',
      options: [
        ['-f, --force', 'Force mode'],
        ['--level <level>', 'Level', { default: 'basic' }],
      ],
      action,
    });
    await c.setup();
    const build = command(findChild(cli, 'build'));
    expect(optionFlags(build)).toMatchSnapshot();
    expect(build.options[1]?.defaultValue).toMatchSnapshot();
    expect(typeof build.actionCalls[0]).toMatchSnapshot();
  });

  it('command handles missing description', async () => {
    const { c, cli } = makeCheetor({ name: 'test' });
    c.command('onlyname');
    await c.setup();
    expect(
      command(findChild(cli, 'onlyname')).descriptionText,
    ).toMatchSnapshot();
  });

  it('command handles module without description', async () => {
    const { c, cli } = makeCheetor({ name: 'test' });
    c.command({ command: 'nondesc' });
    await c.setup();
    expect(
      command(findChild(cli, 'nondesc')).descriptionText,
    ).toMatchSnapshot();
  });

  it('command ignores module without command field', async () => {
    const { c, cli } = makeCheetor({ name: 'test' });
    c.command({ describe: 'no command here' });
    await c.setup();
    expect(cli.commands.length).toMatchSnapshot();
  });

  it('command does nothing for invalid args', async () => {
    const { c, cli } = makeCheetor({ name: 'test' });
    c.command(123 as never);
    await c.setup();
    expect(cli.commands.length).toMatchSnapshot();
  });

  it('each command declares only its own options (Commander-native)', async () => {
    const { c, cli } = makeCheetor({ name: 'test' });
    c.command('deploy', 'Deploy things', (deploy) => {
      deploy.option('-e, --env <env>', 'Target environment');
      deploy.command('rollout <name>', 'Rollout a service', (rollout) => {
        rollout.option('-f, --fast', 'Fast rollout');
      });
    });
    await c.setup();
    const deploy = command(findChild(cli, 'deploy'));
    const rollout = command(findChild(deploy, 'rollout'));
    // Each command lists only its own option; an ancestor's option reaches a
    // descendant through Commander's optsWithGlobals(), not copied onto it.
    expect(optionFlags(deploy)).toMatchSnapshot();
    expect(optionFlags(rollout)).toMatchSnapshot();
  });

  it('same-named option is declared independently at each level', async () => {
    const { c, cli } = makeCheetor({ name: 'test' });
    c.command('a', 'Level A', (a) => {
      a.option('-s, --shared <value>', 'From A', { default: 'from-a' });
      a.command('b', 'Level B', (b) => {
        b.option('-s, --shared <value>', 'From B', { default: 'from-b' });
      });
    });
    await c.setup();
    const nodeA = command(findChild(cli, 'a'));
    const nodeB = command(findChild(nodeA, 'b'));
    const sharedA = nodeA.options.find((option) =>
      option.flags.includes('--shared'),
    );
    const sharedB = nodeB.options.find((option) =>
      option.flags.includes('--shared'),
    );
    // Each level keeps its own default (Commander merges at read time; a shared
    // flag with no explicit value resolves to the shallowest ancestor's default).
    expect(sharedA?.defaultValue).toMatchSnapshot();
    expect(sharedB?.description).toMatchSnapshot();
    expect(sharedB?.defaultValue).toMatchSnapshot();
  });

  it('commandFrom imports a module and registers a command', async () => {
    const { c, cli } = makeCheetor({ name: 'test' }, FIXTURE);
    c.commandFrom('./command.mjs');
    await c.setup();
    const test = command(findChild(cli, 'test'));
    expect(test._name).toMatchSnapshot();
    expect(test.descriptionText).toMatchSnapshot();
    expect(optionFlags(test)).toMatchSnapshot();
    expect(typeof test.actionCalls[0]).toMatchSnapshot();
  });

  it('commandSafe registers module command when present', async () => {
    const { c, cli } = makeCheetor({ name: 'test' }, FIXTURE);
    c.commandSafe('./command.mjs');
    await c.setup();
    expect(command(findChild(cli, 'test'))._name).toMatchSnapshot();
  });

  it('commandFrom handles module without description', async () => {
    const { c, cli } = makeCheetor({ name: 'test' }, FIXTURE);
    c.commandFrom('./deep/nondesc.mjs');
    await c.setup();
    expect(
      command(findChild(cli, 'nondesc')).descriptionText,
    ).toMatchSnapshot();
  });

  it('commandSafe keeps cli when module has no command', async () => {
    const { c, cli } = makeCheetor({ name: 'test' }, FIXTURE);
    c.commandSafe('./nocommand.mjs');
    await c.setup();
    expect(cli.commands.length).toMatchSnapshot();
  });

  it('commandSafe handles module without description', async () => {
    const { c, cli } = makeCheetor({ name: 'test' }, FIXTURE);
    c.commandSafe('./deep/nondesc.mjs');
    await c.setup();
    expect(
      command(findChild(cli, 'nondesc')).descriptionText,
    ).toMatchSnapshot();
  });

  it('commandSafe keeps cli when module is missing', async () => {
    const { c, cli } = makeCheetor({ name: 'test' }, FIXTURE);
    c.commandSafe('./__missing__.mjs');
    await c.setup();
    expect(cli.commands.length).toMatchSnapshot();
  });

  it('commandSafe rethrows real errors', async () => {
    const { c } = makeCheetor({ name: 'test' }, FIXTURE);
    c.commandSafe('./throws.mjs');
    await expect(c.setup()).rejects.toThrow('boom');
  });

  it('commandSmart registers command when module has one', async () => {
    const { c, cli } = makeCheetor({ name: 'test' });
    c.commandSmart(() => ({ command: 'smart', describe: 'command smart' }));
    await c.setup();
    expect(command(findChild(cli, 'smart')).descriptionText).toMatchSnapshot();
  });

  it('commandSmart handles module without description', async () => {
    const { c, cli } = makeCheetor({ name: 'test' });
    c.commandSmart(() => ({ command: 'nondesc' }));
    await c.setup();
    expect(
      command(findChild(cli, 'nondesc')).descriptionText,
    ).toMatchSnapshot();
  });

  it('commandSmart registers module options and action', async () => {
    const { c, cli } = makeCheetor({ name: 'test' });
    const action = vi.fn();
    c.commandSmart(() => ({
      command: 'smart',
      describe: 'command smart',
      options: [['-f, --force', 'Force mode']],
      action,
    }));
    await c.setup();
    const smart = command(findChild(cli, 'smart'));
    expect(optionFlags(smart)).toMatchSnapshot();
    expect(typeof smart.actionCalls[0]).toMatchSnapshot();
  });

  it('commandSmart ignores module without command field', async () => {
    const { c, cli } = makeCheetor({ name: 'test' });
    c.commandSmart(() => ({ describe: 'no command here' }));
    await c.setup();
    expect(cli.commands.length).toMatchSnapshot();
  });

  it('commandSmart keeps cli when func returns nothing', async () => {
    const { c, cli } = makeCheetor({ name: 'test' });
    c.commandSmart(() => ({}));
    await c.setup();
    expect(cli.commands.length).toMatchSnapshot();
  });

  it('website stores site', async () => {
    const { c } = makeCheetor({ name: 'test' });
    c.website('https://site.com');
    expect(c.site).toMatchSnapshot();
  });

  it('setup resolves a parsed snapshot', async () => {
    const { c } = makeCheetor({ name: 'test' });
    let received: unknown;
    await c.setup((parsed) => {
      received = parsed;
      return 'done';
    });
    expect(received).toMatchSnapshot();
  });
});

describe('help rendering', () => {
  it('adds a version header to the program', async () => {
    const { c, cli } = makeCheetor({ name: 'test', version: '1.2.3' });
    await c.setup();
    expect(cli.helpTexts).toMatchSnapshot();
  });

  it('omits the version header when no version', async () => {
    const { c, cli } = makeCheetor({ name: 'test' });
    await c.setup();
    expect(
      cli.helpTexts.some((entry) => entry.position === 'beforeAll'),
    ).toMatchSnapshot();
  });

  it('adds website and repository footer to program and commands', async () => {
    const { c, cli } = makeCheetor({
      name: 'test',
      homepage: 'https://site.com',
      repository: { url: 'git+https://github.com/a/b.git' },
    });
    c.command('sub', 'a sub');
    await c.setup();
    const sub = command(findChild(cli, 'sub'));
    expect(
      cli.helpTexts.filter((entry) => entry.position === 'after'),
    ).toMatchSnapshot();
    expect(
      sub.helpTexts.filter((entry) => entry.position === 'after'),
    ).toMatchSnapshot();
  });

  it('omits website when site equals repository', async () => {
    const { c, cli } = makeCheetor({
      name: 'test',
      repository: { url: 'git+https://github.com/a/b.git' },
    });
    c.website('https://github.com/a/b');
    await c.setup();
    expect(
      cli.helpTexts.filter((entry) => entry.position === 'after'),
    ).toMatchSnapshot();
  });

  it('omits website when site is empty', async () => {
    const { c, cli } = makeCheetor({ name: 'test', homepage: '' });
    c.website('');
    await c.setup();
    expect(cli.helpTexts.length).toMatchSnapshot();
  });

  it('applies the help option label to every command', async () => {
    const { c, cli } = makeCheetor({ name: 'test' });
    c.command('sub', 'a sub');
    await c.setup();
    const sub = command(findChild(cli, 'sub'));
    expect(cli.helpOptionSet).toMatchSnapshot();
    expect(sub.helpOptionSet).toMatchSnapshot();
  });
});

describe('integration via node child process', () => {
  it('base', async () => {
    const stdout = await Run('./test/fixture/base.mjs');
    expect(stdout).toMatchSnapshot();
  });

  it('help', async () => {
    const stdout = await Run('./test/fixture/base.mjs', '-h');
    expect(stdout).toMatchSnapshot();
  });

  it('deep', async () => {
    const stdout = await Run('./test/fixture/deep.mjs');
    expect(stdout).toMatchSnapshot();
  });

  it('okay', async () => {
    const stdout = await Run('./test/fixture/okay.mjs', '-h');
    expect(stdout).toMatchSnapshot();
  });

  it('fail', async () => {
    await Run('./test/fixture/fail.mjs')
      .then(() => {
        throw new Error('should fail');
      })
      .catch((error: { info: string[] }) => {
        expect(error.info).toMatchSnapshot();
      });
  });

  it('command action with force option', async () => {
    const stdout = await Run(
      './test/fixture/command-action.mjs',
      'test',
      '--force',
    );
    expect(stdout).toMatchSnapshot();
  });

  it('command action with level option', async () => {
    const stdout = await Run(
      './test/fixture/command-action.mjs',
      'test',
      '--level',
      'advanced',
    );
    expect(stdout).toMatchSnapshot();
  });

  it('command action without options', async () => {
    const stdout = await Run('./test/fixture/command-action.mjs', 'test');
    expect(stdout).toMatchSnapshot();
  });

  it('command help with options', async () => {
    const stdout = await Run(
      './test/fixture/command-action.mjs',
      'test',
      '--help',
    );
    expect(stdout).toMatchSnapshot();
  });

  it('nested subcommand with inherited options', async () => {
    const stdout = await Run(
      './test/fixture/subcommand.mjs',
      'deploy',
      'rollout',
      'api',
      '--env',
      'prod',
      '--fast',
    );
    expect(stdout).toMatchSnapshot();
  });

  it('subcommand alias routes to canonical child', async () => {
    const stdout = await Run(
      './test/fixture/subcommand.mjs',
      'deploy',
      'go',
      'api',
      '--env',
      'prod',
      '--fast',
    );
    expect(stdout).toMatchSnapshot();
  });

  it('parsed resolves the canonical leaf when invoked via an alias', async () => {
    const stdout = await Run(
      './test/fixture/parsed-alias.mjs',
      'deploy',
      'go',
      'api',
      '--env',
      'prod',
      '--fast',
    );
    expect(stdout).toMatchSnapshot();
  });

  it('subcommand help lists nested command', async () => {
    const stdout = await Run('./test/fixture/subcommand.mjs', 'deploy', '-h');
    expect(stdout).toMatchSnapshot();
  });

  it('three-level subcommand reads merged ancestor options', async () => {
    const stdout = await Run(
      './test/fixture/subcommand-tree.mjs',
      'a',
      'b',
      'c',
      'x',
    );
    expect(stdout).toMatchSnapshot();
  });

  it('explicit flags override ancestor defaults at the leaf', async () => {
    const stdout = await Run(
      './test/fixture/subcommand-tree.mjs',
      'a',
      'b',
      'c',
      'x',
      '--mode',
      'm',
      '--shared',
      'zzz',
    );
    expect(stdout).toMatchSnapshot();
  });

  it('parent without leaf lists subcommands on stderr', async () => {
    await Run('./test/fixture/subcommand.mjs', 'deploy')
      .then(() => {
        throw new Error('should write subcommands to stderr');
      })
      .catch((error: { info: string[] }) => {
        expect(error.info).toMatchSnapshot();
      });
  });

  it('mid-level help lists its subcommands', async () => {
    const stdout = await Run('./test/fixture/subcommand-tree.mjs', 'a', '-h');
    expect(stdout).toMatchSnapshot();
  });

  it('mid-level help lists its own options and subcommand', async () => {
    const stdout = await Run(
      './test/fixture/subcommand-tree.mjs',
      'a',
      'b',
      '-h',
    );
    expect(stdout).toMatchSnapshot();
  });

  it('async action is awaited before setup resolves', async () => {
    const stdout = await Run('./test/fixture/async-action.mjs', 'slow');
    expect(stdout).toMatchSnapshot();
  });

  it('parsed reports the matched subcommand name and its args', async () => {
    const stdout = await Run(
      './test/fixture/parsed.mjs',
      'greet',
      'World',
      '--loud',
    );
    expect(stdout).toMatchSnapshot();
  });
});

describe('public authoring types', () => {
  it('are importable and usable by consumers', () => {
    const pkg: Pkg = { name: 'cli', version: '1.0.0' };
    const verbose: OptionSpec = ['-v, --verbose', 'Verbose output'];
    const commandModule: Module = {
      command: 'build <target>',
      describe: 'Build a target',
      options: [verbose],
      action: () => {},
    };
    const parsed: Parsed = { name: 'build', args: ['app'], options: {} };

    const cheetor = new Cheetor(pkg).command(commandModule);

    expect(cheetor).toBeInstanceOf(Cheetor);
    expect(parsed.name).toBe('build');
  });
});

describe('package entry points', () => {
  it('maps the entry to a typed ESM build for resolvers', () => {
    expect(pkgData.exports['.']).toEqual({
      types: './dist/index.d.mts',
      default: './dist/index.mjs',
    });
    expect(pkgData.main).toBe('dist/index.mjs');
    expect(pkgData.types).toBe('dist/index.d.mts');
  });
});
