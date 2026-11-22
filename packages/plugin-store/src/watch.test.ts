import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { watchPlugins, type Watch } from './watch';

function fakeWatch() {
  const open = new Map<string, () => void>();
  const closed: string[] = [];
  const watch: Watch = (dir, onChange) => {
    open.set(dir, onChange);
    return () => closed.push(dir);
  };
  return { watch, open, closed };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('watchPlugins', () => {
  const root = mkdtempSync(join(tmpdir(), 'feega-watch-'));

  it('watches the install folder and every dev folder', () => {
    const fake = fakeWatch();
    watchPlugins({ root, dev: ['/a', '/b'], onChange: () => undefined, watch: fake.watch });
    expect([...fake.open.keys()]).toEqual([root, '/a', '/b']);
  });

  it('reports once for a burst of file events', () => {
    const fake = fakeWatch();
    const changes: number[] = [];
    watchPlugins({ root, dev: ['/a'], onChange: () => changes.push(1), watch: fake.watch });
    fake.open.get('/a')!();
    fake.open.get('/a')!();
    fake.open.get(root)!();
    vi.advanceTimersByTime(500);
    expect(changes).toHaveLength(1);
  });

  it('stops watching and reporting once closed', () => {
    const fake = fakeWatch();
    const changes: number[] = [];
    const close = watchPlugins({ root, dev: ['/a'], onChange: () => changes.push(1), watch: fake.watch });
    fake.open.get('/a')!();
    close();
    vi.advanceTimersByTime(500);
    expect(changes).toEqual([]);
    expect(fake.closed).toEqual([root, '/a']);
  });
});
