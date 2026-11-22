import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pidFile } from './pid-file';
import { GracefulStop, platformRow } from './platform';

const NOT_EXISTING_PID = 2147483000;

describe('platform table', () => {
  it('macOS keeps the traffic lights, vibrancy and group signals', () => {
    const row = platformRow('darwin');

    expect(row.chrome).toMatchObject({ titleBarStyle: 'hiddenInset', vibrancy: 'under-window', visualEffectState: 'active' });
    expect(row.chrome).not.toHaveProperty('titleBarOverlay');
    expect(row.detached).toBe(true);
    expect(row.graceful).toBe(GracefulStop.Signal);
    expect(row.appMenu).toBe(true);
    expect(row.shortcuts.settings).toBe('⌘,');
  });

  it('Windows draws native controls over the tab bar and stops through stdin and taskkill', () => {
    const row = platformRow('win32');

    expect(row.chrome).toMatchObject({ titleBarStyle: 'hidden', titleBarOverlay: { height: 52 } });
    expect(row.chrome).not.toHaveProperty('vibrancy');
    expect(row.detached).toBe(false);
    expect(row.windowsHide).toBe(true);
    expect(row.graceful).toBe(GracefulStop.Stdin);
    expect(row.appMenu).toBe(false);
    expect(row.shortcuts.quit).toBe('Ctrl+Q');
  });

  it('Linux shares the overlay chrome and uses group signals', () => {
    const row = platformRow('linux');

    expect(row.chrome).toMatchObject({ titleBarStyle: 'hidden', titleBarOverlay: { height: 52 } });
    expect(row.detached).toBe(true);
    expect(row.graceful).toBe(GracefulStop.Signal);
  });

  it('any other platform behaves like Linux', () => {
    expect(platformRow('freebsd')).toBe(platformRow('linux'));
  });
});

describe('pid file on Windows command lines', () => {
  it('matches a recorded command even when the OS quotes the paths', () => {
    const command = 'C:\\Program Files\\Feega\\Feega.exe C:\\Program Files\\Feega\\resources\\npx\\cli.cjs C:\\app --no-open --port 4100';
    const quoted = '"C:\\Program Files\\Feega\\Feega.exe" "C:\\Program Files\\Feega\\resources\\npx\\cli.cjs" C:\\app --no-open --port 4100';
    const pids = pidFile(mkdtempSync(join(tmpdir(), 'feega-win-')), () => quoted);
    pids.add({ pid: NOT_EXISTING_PID, command });

    expect(pids.sweep()).toEqual([NOT_EXISTING_PID]);
  });
});
