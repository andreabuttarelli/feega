import { describe, expect, it } from 'vitest';
import { forget, killOrphans, remember, type Memo } from './orphans';

const memo = (): Memo & { data: Record<string, unknown> } => {
  const data: Record<string, unknown> = {};
  return { data, get: <T>(k: string) => data[k] as T, update: async (k: string, v: unknown) => void (data[k] = v) };
};

describe('processes a previous session left behind', () => {
  it('are killed when they still run the app they were started for', async () => {
    const m = memo();
    await remember(m, 101, '/repo/landing');
    await remember(m, 102, '/repo/web-docs');
    const killed: number[] = [];

    await killOrphans(m, { command: async (pid) => (pid === 101 ? 'node /repo/landing/node_modules/.feega-inspect/launch.mjs' : 'Safari'), kill: (pid) => killed.push(pid) });

    expect(killed).toEqual([101]);
    expect(m.data['feegaInspect.pids']).toEqual([]);
  });

  it('a stopped server is forgotten', async () => {
    const m = memo();
    await remember(m, 7, '/a');
    await forget(m, 7);
    expect(m.data['feegaInspect.pids']).toEqual([]);
  });
});
