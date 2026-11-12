import { describe, expect, it, vi } from 'vitest';
import type { ProviderCall } from './github';

const writes: ProviderCall[] = [];

vi.mock('$env/dynamic/private', () => ({ env: { GITHUB_TOKEN: 'server-token' } }));
vi.mock('./github-runtime', () => ({ githubFor: () => ({ call: async () => null }) }));
vi.mock('$lib/server/repos/canvas', () => ({
  findNode: async () => ({ projectId: 'p1', data: { code: { kind: 'github', repo: 'victim/repo', branch: 'main', sha: 'abc1234', routes: ['/'] } } })
}));
vi.mock('$lib/server/motion/move-element', () => ({ frameStore: () => ({ read: async () => ({ doc: {}, version: 1 }) }) }));
vi.mock('./token-write', () => ({ frameEdits: async () => ({ files: [{ path: 'a.css', before: 'a{}', after: 'b{}' }], skipped: [], map: {} }) }));
vi.mock('./repo-sync', async (real) => ({
  ...(await real<typeof import('./repo-sync')>()),
  tokenCall: () => async (request: ProviderCall) => {
    if (request.method && request.method !== 'GET') {
      writes.push(request);
    }
    return { status: 200, data: { default_branch: 'main', sha: 'abc1234', object: { sha: 'abc1234' }, tree: { sha: 't' } } };
  }
}));

const { codePublish, SyncOutcome } = await import('./code-sync');

describe('codePublish', () => {
  it('never publishes with the server token when the user has no GitHub', async () => {
    const out = await codePublish({ orgId: 'o1', userId: 'u1', projectId: 'p1', db: {} } as never, 'node-1');

    expect(writes).toEqual([]);
    expect(out.outcome).toBe(SyncOutcome.NoGithub);
  });
});
