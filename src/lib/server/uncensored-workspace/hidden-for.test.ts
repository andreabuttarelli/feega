import { describe, expect, it, vi } from 'vitest';
import { UncensoredLock } from '$lib/uncensored-lock';

const gate = vi.hoisted(() => ({ projectsAsked: Promise.resolve() as Promise<unknown>, ask: () => {} }));

vi.mock('./workspace-server', () => ({ uncensoredLockFor: async () => (await gate.projectsAsked, UncensoredLock.OrgNotOptedIn) }));

const { hiddenFor } = await import('./hidden-scope');

const rows = { projects: [{ id: 'p-n' }], canvases: [{ id: 'c-n' }], nodes: [{ id: 'n-n' }] } as Record<string, { id: string }[]>;

const db = {
  from: (table: string) => {
    if (table === 'projects') {
      gate.ask();
    }
    const chain = { select: () => chain, eq: () => chain, in: () => chain, then: (resolve: (r: { data: unknown }) => unknown) => resolve({ data: rows[table] ?? [] }) };
    return chain;
  }
};

describe('hiddenFor', () => {
  it('looks up the uncensored projects while it reads the lock, not after', async () => {
    gate.projectsAsked = new Promise((asked) => (gate.ask = () => asked(null)));

    expect(await hiddenFor(db as never, { orgId: 'o', userId: 'u' })).toEqual({ projectIds: ['p-n'], canvasIds: ['c-n'], nodeIds: ['n-n'] });
  });
});
