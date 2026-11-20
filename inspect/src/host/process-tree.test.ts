import { describe, expect, it, vi } from 'vitest';
import { commandLineOf, killTree, type TreeHost } from './process-tree';

const host = (platform: NodeJS.Platform) => ({ platform, run: vi.fn(), signal: vi.fn() }) satisfies TreeHost;

describe('killTree', () => {
  it('kills the whole tree with taskkill on windows', () => {
    const win = host('win32');
    killTree(42, 'SIGTERM', win);
    expect(win.run).toHaveBeenCalledWith('taskkill', ['/pid', '42', '/T', '/F']);
    expect(win.signal).not.toHaveBeenCalled();
  });

  it('signals the process group elsewhere', () => {
    const linux = host('linux');
    killTree(42, 'SIGKILL', linux);
    expect(linux.signal).toHaveBeenCalledWith(-42, 'SIGKILL');
    expect(linux.run).not.toHaveBeenCalled();
  });

  it('ignores a group that is already gone', () => {
    const linux = host('linux');
    linux.signal.mockImplementation(() => {
      throw new Error('ESRCH');
    });
    expect(() => killTree(42, 'SIGTERM', linux)).not.toThrow();
  });
});

describe('commandLineOf', () => {
  it('asks powershell on windows and ps elsewhere', () => {
    expect(commandLineOf(7, 'win32')[0]).toBe('powershell');
    expect(commandLineOf(7, 'darwin')).toEqual(['ps', ['-o', 'command=', '-p', '7']]);
  });
});
