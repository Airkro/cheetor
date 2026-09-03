import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { importFrom, importFromSafe } from '../src/lib.mts';
import { Cheetor } from '../src/index.mts';

import { Run } from './helper/util.mts';

const pkgData = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

interface FakeHelpSection {
  title?: string;
  body?: string;
}

type FakeHelpCallback = (sections: FakeHelpSection[]) => FakeHelpSection[];

interface FakeCommand {
  rawName: unknown;
  description: string;
  optionCalls: unknown[][];
  actionCalls: unknown[];
  action: (fn: unknown) => FakeCommand;
  option: (...args: unknown[]) => FakeCommand;
}

interface FakeGlobalCommand {
  usageText: string;
  helpCallback: FakeHelpCallback;
}

interface FakeCtrl {
  name: string;
  version: string | undefined;
  helpCalled: boolean;
  commands: FakeCommand[];
  usageText: string;
  helpCallback: FakeHelpCallback;
  parseResult: string;
  commandCalls: unknown[][];
}

interface FakeCli {
  name: string;
  commands: FakeCommand[];
  globalCommand: FakeGlobalCommand;
  help: () => FakeCli;
  version: (v: string) => FakeCli;
  usage: (t: string) => FakeCli;
  command: (...args: unknown[]) => FakeCommand;
  parse: () => string;
}

interface FakeCreated {
  ctrl: FakeCtrl;
  cli: FakeCli;
}

function firstCommand(ctrl: FakeCtrl): FakeCommand {
  const cmd = ctrl.commands[0];
  if (!cmd) {
    throw new Error('expected a command to be registered');
  }
  return cmd;
}

const h = vi.hoisted(() => {
  const created: FakeCreated[] = [];

  function make(name?: string): FakeCli {
    const ctrl: FakeCtrl = {
      name: name || '',
      version: undefined,
      helpCalled: false,
      commands: [],
      usageText: '<command> [options]',
      helpCallback: (sections) => sections,
      parseResult: 'parsed',
      commandCalls: [],
    };

    const globalCommand: FakeGlobalCommand = {
      usageText: '<command> [options]',
      get helpCallback() {
        return ctrl.helpCallback;
      },
      set helpCallback(fn: FakeHelpCallback) {
        ctrl.helpCallback = fn;
      },
    };

    const cli: FakeCli = {
      get name() {
        return ctrl.name;
      },
      set name(n: string) {
        ctrl.name = n;
      },
      get commands() {
        return ctrl.commands;
      },
      get globalCommand() {
        return globalCommand;
      },
      help() {
        ctrl.helpCalled = true;
        return cli;
      },
      version(v: string) {
        ctrl.version = v;
        return cli;
      },
      usage(t: string) {
        ctrl.usageText = t;
        globalCommand.usageText = t;
        return cli;
      },
      command(...args: unknown[]) {
        ctrl.commandCalls.push(args);
        const cmd: FakeCommand = {
          rawName: args[0],
          description: (args[1] as string) || '',
          optionCalls: [],
          actionCalls: [],
          action: (fn: unknown) => {
            cmd.actionCalls.push(fn);
            return cmd;
          },
          option: (...oargs: unknown[]) => {
            cmd.optionCalls.push(oargs);
            return cmd;
          },
        };
        ctrl.commands.push(cmd);
        return cmd;
      },
      parse() {
        return ctrl.parseResult;
      },
    };

    created.push({ ctrl, cli });
    return cli;
  }

  return { created, make };
});

vi.mock('cac', () => ({
  cac: (name?: string) => h.make(name),
  default: (name?: string) => h.make(name),
}));

const FIXTURE = new URL('./fixture/', import.meta.url).href;

function makeCheetor(
  pkg: ConstructorParameters<typeof Cheetor>[0],
  root: ConstructorParameters<typeof Cheetor>[1] = import.meta.url,
) {
  const c = new Cheetor(pkg, root);
  const entry = h.created.at(-1);
  if (!entry) {
    throw new Error('no fake cli was created');
  }
  return { c, ctrl: entry.ctrl, cli: entry.cli };
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
    const { c, ctrl } = makeCheetor({
      homepage: 'https://example.com',
      repository: { url: 'https://example.com/x.git' },
    });
    expect(c.repository).toMatchSnapshot();
    expect(c.homepage).toMatchSnapshot();
    expect(ctrl.name).toMatchSnapshot();
  });

  it('uses pkg name when bin is a string', () => {
    const { ctrl } = makeCheetor({ name: 'mypkg', bin: 'bin.js' });
    expect(ctrl.name).toMatchSnapshot();
  });

  it('uses single bin key when bin is a single-key object', () => {
    const { ctrl } = makeCheetor({ name: 'mypkg', bin: { one: 'x' } });
    expect(ctrl.name).toMatchSnapshot();
  });

  it('uses pkg name when bin object has many keys', () => {
    const { ctrl } = makeCheetor({
      name: 'mypkg',
      bin: { one: 'x', two: 'y' },
    });
    expect(ctrl.name).toMatchSnapshot();
  });

  it('enables help on cli', () => {
    const { ctrl } = makeCheetor({ name: 'mypkg' });
    expect(ctrl.helpCalled).toMatchSnapshot();
  });

  it('sets version when provided', () => {
    const { ctrl } = makeCheetor({ name: 'mypkg', version: '1.2.3' });
    expect(ctrl.version).toMatchSnapshot();
  });

  it('does not set version when not provided', () => {
    const { ctrl } = makeCheetor({ name: 'mypkg' });
    expect(ctrl.version).toMatchSnapshot();
  });
});

describe('Cheetor methods', () => {
  it('config calls the function with the cli', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' });
    let receivedName = '';
    c.config((cli) => {
      receivedName = cli.name;
      return cli;
    });
    await c.setup();
    expect(receivedName).toMatchSnapshot();
    expect(ctrl.parseResult).toMatchSnapshot();
  });

  it('command registers with string name and description', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' });
    c.command('static', 'description');
    await c.setup();
    expect(ctrl.commandCalls).toMatchSnapshot();
    expect(ctrl.commands).toMatchSnapshot();
  });

  it('command registers with module object', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' });
    c.command({ command: 'test', describe: 'command test' });
    await c.setup();
    expect(ctrl.commandCalls).toMatchSnapshot();
  });

  it('command registers module options and action', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' });
    const action = vi.fn();
    c.command({
      command: 'test',
      describe: 'command test',
      options: [
        ['-f, --force', 'Force mode'],
        ['--level <level>', 'Level', { default: 'basic' }],
      ],
      action,
    });
    await c.setup();
    expect(ctrl.commands).toMatchSnapshot();
    expect(firstCommand(ctrl).actionCalls[0]).toMatchSnapshot();
  });

  it('command handles missing description', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' });
    c.command('onlyname');
    await c.setup();
    expect(ctrl.commandCalls).toMatchSnapshot();
  });

  it('command handles module without description', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' });
    c.command({ command: 'nondesc' });
    await c.setup();
    expect(ctrl.commandCalls).toMatchSnapshot();
  });

  it('command ignores module without command field', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' });
    c.command({ describe: 'no command here' });
    await c.setup();
    expect(ctrl.commandCalls).toMatchSnapshot();
  });

  it('command does nothing for invalid args', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' });
    c.command(123 as never);
    await c.setup();
    expect(ctrl.commandCalls).toMatchSnapshot();
  });

  it('commandFrom imports a module and registers a command', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' }, FIXTURE);
    c.commandFrom('./command.mjs');
    await c.setup();
    expect(ctrl.commandCalls).toMatchSnapshot();
    expect(ctrl.commands).toMatchSnapshot();
    expect(typeof firstCommand(ctrl).actionCalls[0]).toMatchSnapshot();
  });

  it('commandSafe registers module command when present', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' }, FIXTURE);
    c.commandSafe('./command.mjs');
    await c.setup();
    expect(ctrl.commandCalls).toMatchSnapshot();
    expect(ctrl.commands).toMatchSnapshot();
    expect(typeof firstCommand(ctrl).actionCalls[0]).toMatchSnapshot();
  });

  it('commandFrom handles module without description', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' }, FIXTURE);
    c.commandFrom('./deep/nondesc.mjs');
    await c.setup();
    expect(ctrl.commandCalls).toMatchSnapshot();
  });

  it('commandSafe keeps cli when module has no command', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' }, FIXTURE);
    c.commandSafe('./nocommand.mjs');
    await c.setup();
    expect(ctrl.commandCalls).toMatchSnapshot();
  });

  it('commandSafe handles module without description', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' }, FIXTURE);
    c.commandSafe('./deep/nondesc.mjs');
    await c.setup();
    expect(ctrl.commandCalls).toMatchSnapshot();
  });

  it('commandSafe keeps cli when module is missing', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' }, FIXTURE);
    c.commandSafe('./__missing__.mjs');
    await c.setup();
    expect(ctrl.commandCalls).toMatchSnapshot();
  });

  it('commandSafe rethrows real errors', async () => {
    const { c } = makeCheetor({ name: 'test' }, FIXTURE);
    c.commandSafe('./throws.mjs');
    await expect(c.setup()).rejects.toThrow('boom');
  });

  it('commandSmart registers command when module has one', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' });
    c.commandSmart(() => ({ command: 'smart', describe: 'command smart' }));
    await c.setup();
    expect(ctrl.commandCalls).toMatchSnapshot();
  });

  it('commandSmart handles module without description', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' });
    c.commandSmart(() => ({ command: 'nondesc' }));
    await c.setup();
    expect(ctrl.commandCalls).toMatchSnapshot();
  });

  it('commandSmart registers module options and action', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' });
    const action = vi.fn();
    c.commandSmart(() => ({
      command: 'smart',
      describe: 'command smart',
      options: [['-f, --force', 'Force mode']],
      action,
    }));
    await c.setup();
    expect(ctrl.commands).toMatchSnapshot();
    expect(firstCommand(ctrl).actionCalls[0]).toMatchSnapshot();
  });

  it('commandSmart ignores module without command field', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' });
    c.commandSmart(() => ({ describe: 'no cmd' }));
    await c.setup();
    expect(ctrl.commandCalls).toMatchSnapshot();
  });

  it('commandSmart keeps cli when func returns nothing', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' });
    c.commandSmart(() => {});
    await c.setup();
    expect(ctrl.commandCalls).toMatchSnapshot();
  });

  it('website stores site', async () => {
    const { c } = makeCheetor({ name: 'test' });
    c.website('https://site.com');
    expect(c.site).toMatchSnapshot();
  });

  it('setup invokes action with parsed value', async () => {
    const { c } = makeCheetor({ name: 'test' });
    const result = await c.setup((parsed) => {
      expect(parsed).toMatchSnapshot();
      return 'action';
    });
    expect(result).toMatchSnapshot();
  });
});

describe('ready usage rendering', () => {
  it('sets empty usage when no commands', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' });
    await c.setup();
    expect(ctrl.usageText).toMatchSnapshot();
  });

  it('sets command usage when commands exist', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' });
    c.command('cmd', 'desc');
    await c.setup();
    expect(ctrl.usageText).toMatchSnapshot();
  });

  it('preserves custom usage text', async () => {
    const { c, ctrl, cli } = makeCheetor({ name: 'test' });
    cli.usage('custom usage');
    await c.setup();
    expect(ctrl.usageText).toMatchSnapshot();
  });

  it('sets help callback with website and repository', async () => {
    const { c, ctrl } = makeCheetor({
      name: 'test',
      homepage: 'https://site.com',
      repository: { url: 'git+https://github.com/a/b.git' },
    });
    await c.setup();
    expect(typeof ctrl.helpCallback).toMatchSnapshot();
    const sections: FakeHelpSection[] = [];
    const result = ctrl.helpCallback(sections);
    expect(result).toMatchSnapshot();
  });

  it('help callback adds website section', async () => {
    const { c, ctrl } = makeCheetor({
      name: 'test',
      homepage: 'https://site.com',
      repository: { url: '' },
    });
    await c.setup();
    const sections: FakeHelpSection[] = [];
    const result = ctrl.helpCallback(sections);
    expect(result).toMatchSnapshot();
  });

  it('help callback adds repository section', async () => {
    const { c, ctrl } = makeCheetor({
      name: 'test',
      homepage: '',
      repository: { url: 'git+https://github.com/a/b.git' },
    });
    await c.setup();
    const sections: FakeHelpSection[] = [];
    const result = ctrl.helpCallback(sections);
    expect(result).toMatchSnapshot();
  });

  it('help callback omits website when site is empty', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test', homepage: '' });
    c.website('');
    await c.setup();
    const sections: FakeHelpSection[] = [];
    const result = ctrl.helpCallback(sections);
    expect(result).toMatchSnapshot();
  });

  it('help callback customizes usage for no-command case', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' });
    await c.setup();

    const sections = [
      { body: 'test' },
      { title: 'Usage', body: '  $ test <command> [options]' },
      { title: 'Options', body: '-h, --help' },
    ];
    const result = ctrl.helpCallback(sections);
    expect(result).toMatchSnapshot();
  });

  it('help callback keeps usage for command case', async () => {
    const { c, ctrl } = makeCheetor({ name: 'test' });
    c.command('cmd', 'desc');
    await c.setup();

    const sections = [
      { body: 'test' },
      { title: 'Usage', body: '  $ test <command>' },
      { title: 'Commands', body: 'cmd  desc' },
    ];
    const result = ctrl.helpCallback(sections);
    expect(result).toMatchSnapshot();
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
});
