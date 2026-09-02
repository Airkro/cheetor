import { describe, expect, it, vi } from 'vitest';

import { importFrom, importFromSafe } from '../src/lib.mjs';
import { Cheetor } from '../src/index.mjs';

import { Run } from './helper/util.mts';

const h = vi.hoisted(() => {
  const created: Array<{ ctrl: any; cli: any }> = [];

  function make() {
    const ctrl: any = {
      handlers: {},
      usage: [],
      parseResult: 'parsed',
      scriptName: undefined,
      usageMsg: undefined,
      demand: false,
      epilogues: [] as string[],
      commandArg: undefined,
      middlewareArgs: undefined,
      configCalls: 0,
    };

    const cli: any = {
      strict() {
        return cli;
      },
      alias() {
        return cli;
      },
      hide() {
        return cli;
      },
      version() {
        return cli;
      },
      detectLocale() {
        return cli;
      },
      scriptName(n: any) {
        ctrl.scriptName = n;
        return cli;
      },
      usage(s: any) {
        ctrl.usageMsg = s;
        return cli;
      },
      demandCommand() {
        ctrl.demand = true;
        return cli;
      },
      epilogue(s: any) {
        ctrl.epilogues.push(s);
        return cli;
      },
      command(m: any) {
        ctrl.commandArg = m;
        return cli;
      },
      middleware(...a: any[]) {
        ctrl.middlewareArgs = a;
        return cli;
      },
      parse() {
        return ctrl.parseResult;
      },
      getInternalMethods() {
        return {
          getCommandInstance: () => ({ handlers: ctrl.handlers }),
          getUsageInstance: () => ({ getUsage: () => ctrl.usage }),
        };
      },
    };

    created.push({ ctrl, cli });
    return cli;
  }

  return { created, make };
});

vi.mock('yargs', () => ({ default: () => h.make() }));

const FIXTURE = new URL('./fixture/', import.meta.url).href;

function makeCheetor(pkg: any, root: any = import.meta.url) {
  const c = new Cheetor(pkg, root);
  const entry = h.created.at(-1);
  if (!entry) {
    throw new Error('no fake cli was created');
  }
  return { c, ctrl: entry.ctrl };
}

describe('lib', () => {
  it('importFrom with relative path', async () => {
    const mod = await importFrom('./command.mjs', FIXTURE);
    expect(mod.command).toBe('test');
  });

  it('importFrom with bare path', async () => {
    const mod = await importFrom('node:path');
    expect(typeof mod.join).toBe('function');
  });

  it('importFromSafe success', async () => {
    const mod = await importFromSafe('./command.mjs', FIXTURE);
    expect(mod.command).toBe('test');
  });

  it('importFromSafe returns false on missing module', async () => {
    const result = await importFromSafe('./__missing__.mjs', FIXTURE);
    expect(result).toBe(false);
  });

  it('importFromSafe rethrows non-module errors', async () => {
    await expect(importFromSafe('./throws.mjs', FIXTURE)).rejects.toThrow(
      'boom',
    );
  });
});

describe('Cheetor constructor', () => {
  it('reads a package.json string and strips repository', () => {
    const { c } = makeCheetor('../package.json');
    expect(c.homepage).toBe('https://www.npmjs.com/package/cheetor');
    expect(c.repository).toBe('git+https://github.com/airkro/cheetor');
  });

  it('ignores non-github repository and defaults name', () => {
    const { c, ctrl } = makeCheetor({
      homepage: 'https://example.com',
      repository: { url: 'https://example.com/x.git' },
    });
    expect(c.repository).toBe('');
    expect(c.homepage).toBe('https://example.com');
    expect(ctrl.scriptName).toBe('cheetor');
  });

  it('uses pkg name when bin is a string', () => {
    const { ctrl } = makeCheetor({ name: 'mypkg', bin: 'bin.js' });
    expect(ctrl.scriptName).toBe('mypkg');
  });

  it('uses single bin key when bin is a single-key object', () => {
    const { ctrl } = makeCheetor({ name: 'mypkg', bin: { one: 'x' } });
    expect(ctrl.scriptName).toBe('one');
  });

  it('sets no scriptName when bin object has many keys', () => {
    const { ctrl } = makeCheetor({
      name: 'mypkg',
      bin: { one: 'x', two: 'y' },
    });
    expect(ctrl.scriptName).toBeUndefined();
  });
});

describe('Cheetor methods', () => {
  it('config appends a function to the cli chain', async () => {
    const { c, ctrl } = makeCheetor({});
    c.config((cli: any) => {
      ctrl.configCalls += 1;
      return cli;
    });
    expect(await c.setup()).toBe('parsed');
    expect(ctrl.configCalls).toBe(1);
  });

  it('command forwards args', async () => {
    const { c, ctrl } = makeCheetor({});
    c.command('static', 'description');
    await c.setup();
    expect(ctrl.commandArg).toBe('static');
  });

  it('middleware forwards args and website stores site', async () => {
    const { c, ctrl } = makeCheetor({ homepage: 'h' });
    c.middleware('a', 'b');
    c.website('https://site.com');
    await c.setup();
    expect(ctrl.middlewareArgs).toEqual(['a', 'b']);
    expect(c.site).toBe('https://site.com');
  });

  it('commandFrom imports a module and registers a command', async () => {
    const { c, ctrl } = makeCheetor({}, FIXTURE);
    c.commandFrom('./command.mjs');
    await c.setup();
    expect(ctrl.commandArg).toBeDefined();
  });

  it('commandSafe registers module command when present', async () => {
    const { c, ctrl } = makeCheetor({}, FIXTURE);
    c.commandSafe('./command.mjs');
    await c.setup();
    expect(ctrl.commandArg).toBeDefined();
  });

  it('commandSafe keeps cli when module has no command', async () => {
    const { c, ctrl } = makeCheetor({}, FIXTURE);
    c.commandSafe('./nocommand.mjs');
    await c.setup();
    expect(ctrl.commandArg).toBeUndefined();
  });

  it('commandSafe keeps cli when module is missing', async () => {
    const { c, ctrl } = makeCheetor({}, FIXTURE);
    c.commandSafe('./__missing__.mjs');
    await c.setup();
    expect(ctrl.commandArg).toBeUndefined();
  });

  it('commandSafe rethrows real errors', async () => {
    const { c } = makeCheetor({}, FIXTURE);
    c.commandSafe('./throws.mjs');
    await expect(c.setup()).rejects.toThrow('boom');
  });

  it('commandSmart registers command when module has one', async () => {
    const { c, ctrl } = makeCheetor({});
    c.commandSmart(() => ({ command: 'smart' }));
    await c.setup();
    expect(ctrl.commandArg).toEqual({ command: 'smart' });
  });

  it('commandSmart keeps cli when func returns nothing', async () => {
    const { c, ctrl } = makeCheetor({});
    c.commandSmart(() => {});
    await c.setup();
    expect(ctrl.commandArg).toBeUndefined();
  });

  it('setup invokes action with parsed value', async () => {
    const { c } = makeCheetor({});
    const result = await c.setup((parsed: any) => {
      expect(parsed).toBe('parsed');
      return 'action';
    });
    expect(result).toBe('action');
  });
});

describe('ready usage rendering', () => {
  it('renders simple usage without a command', async () => {
    const { c, ctrl } = makeCheetor({ homepage: '', repository: { url: '' } });
    c.website('');
    ctrl.usage = [];
    ctrl.handlers = {};
    await c.setup();
    expect(ctrl.usageMsg).toBe('Usage: $0');
    expect(ctrl.demand).toBe(false);
    expect(ctrl.epilogues).toEqual([]);
  });

  it('renders command usage with website and repository', async () => {
    const { c, ctrl } = makeCheetor({
      homepage: 'https://site.com',
      repository: { url: 'git+https://github.com/a/b.git' },
    });
    ctrl.handlers = { '': 0, $0: 1, cmd: 1 };
    ctrl.usage = [];
    await c.setup();
    expect(ctrl.usageMsg).toBe('Usage: $0 <command>');
    expect(ctrl.demand).toBe(true);
    expect(ctrl.epilogues).toEqual([
      'Website: https://site.com',
      'Repository: https://github.com/a/b',
    ]);
  });

  it('keeps existing usage text', async () => {
    const { c, ctrl } = makeCheetor({ repository: { url: 'https://x.com' } });
    ctrl.usage = ['predefined'];
    ctrl.handlers = { cmd: 1 };
    await c.setup();
    expect(ctrl.usageMsg).toBeUndefined();
    expect(ctrl.demand).toBe(true);
  });

  it('omits repository epilogue when repository is empty', async () => {
    const { c, ctrl } = makeCheetor({ homepage: 'https://site.com' });
    ctrl.handlers = {};
    ctrl.usage = [];
    await c.setup();
    expect(ctrl.epilogues).toEqual(['Website: https://site.com']);
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
      .catch((error: any) => {
        expect(error.info).toMatchSnapshot();
      });
  });
});
