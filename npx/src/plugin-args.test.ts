import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Browser, Run, argsOf } from './args';
import { PluginAction } from './plugin-args';

const cwd = resolve('/work');

describe('npx feega plugin arguments', () => {
  it('add takes a source', () => {
    expect(argsOf(['plugin', 'add', 'github:acme/hello@v1'], cwd)).toEqual({ run: Run.Plugin, action: PluginAction.Add, value: 'github:acme/hello@v1' });
  });

  it('remove takes an id', () => {
    expect(argsOf(['plugin', 'remove', 'acme.hello'], cwd)).toEqual({ run: Run.Plugin, action: PluginAction.Remove, value: 'acme.hello' });
  });

  it('list takes nothing', () => {
    expect(argsOf(['plugin', 'list'], cwd)).toEqual({ run: Run.Plugin, action: PluginAction.List, value: '' });
  });

  it('dev opens the editor on this folder with the plugin folder loaded', () => {
    expect(argsOf(['plugin', 'dev', 'my-plugin', '--no-open'], cwd)).toEqual({ run: Run.Editor, dir: cwd, port: 0, browser: Browser.Stay, devPlugins: [resolve(cwd, 'my-plugin')] });
  });

  it.each([['plugin'], ['plugin', 'add'], ['plugin', 'remove'], ['plugin', 'dev'], ['plugin', 'publish', 'x']])('refuses %j', (...argv) => {
    expect(argsOf(argv, cwd).run).toBe(Run.Error);
  });
});
