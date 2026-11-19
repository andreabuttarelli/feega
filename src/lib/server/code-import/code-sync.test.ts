import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));
vi.mock('./github-runtime', () => ({ githubFor: () => ({ call: async () => null }) }));
vi.mock('$lib/server/repos/canvas', () => ({
  findNode: async () => ({ projectId: 'p1', data: { code: { kind: 'github', repo: 'victim/repo', branch: 'main', sha: 'abc1234', routes: ['/'] } } })
}));
vi.mock('$lib/server/motion/move-element', () => ({ frameStore: () => ({ read: async () => ({ doc: {}, version: 1 }) }) }));
vi.mock('./token-write', () => ({ frameEdits: async () => ({ files: [{ path: 'a.css', before: 'a{}', after: 'b{}' }], skipped: [], map: {} }) }));
const { codePublish, SyncOutcome } = await import('./code-sync');

describe('codePublish', () => {
  it('without a connected GitHub there is nothing to publish with', async () => {
    const out = await codePublish({ orgId: 'o1', userId: 'u1', projectId: 'p1', db: {} } as never, 'node-1');

    expect(out.outcome).toBe(SyncOutcome.NoGithub);
  });
});
