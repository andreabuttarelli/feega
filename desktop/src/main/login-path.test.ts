import { describe, expect, it } from 'vitest';
import { mergePaths, pathFromShellOutput, readLoginPath } from './login-path';

describe('login path', () => {
  it('takes the last line of shell output as the PATH', () => {
    expect(pathFromShellOutput('Last login: x\nwelcome\n/usr/local/bin:/usr/bin\n')).toBe('/usr/local/bin:/usr/bin');
  });

  it('ignores output that is not a path list', () => {
    expect(pathFromShellOutput('oh no\n')).toBeNull();
    expect(pathFromShellOutput('')).toBeNull();
  });

  it('puts login entries first and keeps the current ones once', () => {
    expect(mergePaths('/opt/homebrew/bin:/usr/bin', '/usr/bin:/bin')).toBe('/opt/homebrew/bin:/usr/bin:/bin');
  });

  it('asks the user shell once and merges its PATH', async () => {
    const asked: string[][] = [];
    const env = { SHELL: '/bin/zsh', PATH: '/usr/bin' } as NodeJS.ProcessEnv;
    await readLoginPath({ platform: 'darwin', env, run: async (shell, args) => (asked.push([shell, ...args]), '/opt/homebrew/bin:/usr/bin\n') });

    expect(asked).toEqual([['/bin/zsh', '-ilc', 'echo $PATH']]);
    expect(env.PATH).toBe('/opt/homebrew/bin:/usr/bin');
  });

  it('leaves PATH alone on Windows and when the shell fails', async () => {
    const env = { SHELL: '/bin/zsh', PATH: '/usr/bin' } as NodeJS.ProcessEnv;
    await readLoginPath({ platform: 'win32', env, run: async () => '/x' });
    await readLoginPath({ platform: 'darwin', env, run: async () => Promise.reject(new Error('timeout')) });

    expect(env.PATH).toBe('/usr/bin');
  });
});
