import { describe, expect, it } from 'vitest';
import { CloudError, CloudFailure, VisitorRole, cloudApi } from './cloud-api';

type Call = { url: string; method: string; auth: string | null; body: unknown };

const recorder = (status: number, body: unknown, token: string | null = 'jwt-1') => {
  const calls: Call[] = [];
  const fetchStub = (async (url: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    calls.push({ url, method: init.method ?? 'GET', auth: headers.get('authorization'), body: init.body ? JSON.parse(String(init.body)) : undefined });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { calls, api: cloudApi({ base: 'https://oh.test', token: async () => token, fetch: fetchStub }) };
};

const comment = { id: 'c1', sessionId: 's1', authorId: 'u1', authorName: 'Ada', body: 'Tighter', selector: 'div.card', sourceFile: 'src/Card.svelte', sourceLine: 4, sourceCol: 2, parentId: null, createdAt: '2026-11-21T10:00:00Z', resolvedAt: null, resolvedBy: null };

describe('cloud api client', () => {
  it('starts a session with the bearer token and the visitor role', async () => {
    const { api, calls } = recorder(201, { id: 's1', url: 'https://s1.sessions.test', hostToken: 'h', expiresAt: '2026-11-21T22:00:00Z' });

    const started = await api.startSession('shop', VisitorRole.Editor);

    expect(started.id).toBe('s1');
    expect(calls).toEqual([{ url: 'https://oh.test/api/v1/sessions', method: 'POST', auth: 'Bearer jwt-1', body: { projectName: 'shop', visitorRole: 'editor' } }]);
  });

  it('closes a session and returns the snapshot upload url', async () => {
    const { api, calls } = recorder(200, { snapshotUploadUrl: 'https://store/up' });

    expect(await api.closeSession('s1')).toEqual({ snapshotUploadUrl: 'https://store/up' });
    expect(calls[0]).toMatchObject({ url: 'https://oh.test/api/v1/sessions/s1/close', method: 'POST' });
  });

  it('lists live sessions', async () => {
    const { api, calls } = recorder(200, { sessions: [{ id: 's1' }] });

    expect(await api.liveSessions()).toEqual([{ id: 's1' }]);
    expect(calls[0].url).toBe('https://oh.test/api/v1/sessions?status=live');
  });

  it('lists open comments only when asked', async () => {
    const { api, calls } = recorder(200, { comments: [comment] });

    await api.comments('s1', true);
    await api.comments('s1', false);

    expect(calls.map((c) => c.url)).toEqual(['https://oh.test/api/v1/sessions/s1/comments?open=1', 'https://oh.test/api/v1/sessions/s1/comments']);
  });

  it('posts a comment with its element and source', async () => {
    const { api, calls } = recorder(201, comment);
    const draft = { body: 'Tighter', selector: 'div.card', sourceFile: 'src/Card.svelte', sourceLine: 4, sourceCol: 2 };

    expect(await api.addComment('s1', draft)).toEqual(comment);
    expect(calls[0]).toEqual({ url: 'https://oh.test/api/v1/sessions/s1/comments', method: 'POST', auth: 'Bearer jwt-1', body: draft });
  });

  it('resolves a comment with an optional note', async () => {
    const { api, calls } = recorder(200, { ...comment, resolvedAt: 'now' });

    await api.resolve('s1', 'c1', 'Done');

    expect(calls[0]).toMatchObject({ url: 'https://oh.test/api/v1/sessions/s1/comments/c1', method: 'PATCH', body: { resolved: true, note: 'Done' } });
  });

  it('saves a named snapshot', async () => {
    const { api, calls } = recorder(201, { url: 'https://oh.test/s/s1/snap' });

    expect(await api.snapshot('s1', 'v2')).toEqual({ url: 'https://oh.test/s/s1/snap' });
    expect(calls[0]).toMatchObject({ url: 'https://oh.test/api/v1/sessions/s1/snapshots', method: 'POST', body: { name: 'v2' } });
  });

  it('promotes a member', async () => {
    const { api, calls } = recorder(200, {});

    await api.setMember('s1', 'u9', VisitorRole.Editor);

    expect(calls[0]).toMatchObject({ url: 'https://oh.test/api/v1/sessions/s1/members/u9', method: 'POST', body: { role: 'editor' } });
  });

  it('refuses without a token and sends nothing', async () => {
    const { api, calls } = recorder(200, {}, null);

    await expect(api.liveSessions()).rejects.toMatchObject({ failure: CloudFailure.NotSignedIn });
    expect(calls).toEqual([]);
  });

  it('maps 402 to plan required', async () => {
    const { api } = recorder(402, { error: 'plan_required' });

    await expect(api.startSession('shop', VisitorRole.Viewer)).rejects.toMatchObject({ failure: CloudFailure.PlanRequired });
  });

  it('maps a 402 seats_exhausted to its own failure', async () => {
    const { api } = recorder(402, { error: 'seats_exhausted' });

    await expect(api.setMember('abcdefghij', 'ada', VisitorRole.Editor)).rejects.toMatchObject({ failure: CloudFailure.SeatsExhausted });
  });

  it('fetches the files of a Pro item for one framework', async () => {
    const { api, calls } = recorder(200, { id: 'hover-reveal', version: 'v1', framework: 'svelte', files: [{ path: 'HoverReveal.svelte', content: '<div />' }] });

    expect(await api.libraryPro('hover-reveal', 'svelte')).toEqual([{ path: 'HoverReveal.svelte', content: '<div />' }]);
    expect(calls).toEqual([{ url: 'https://oh.test/api/v1/library/pro/hover-reveal?framework=svelte', method: 'GET', auth: 'Bearer jwt-1', body: undefined }]);
  });

  it('maps a 401 from the server to not signed in', async () => {
    const { api } = recorder(401, { error: 'Invalid or expired token' });

    await expect(api.libraryPro('hover-reveal', 'svelte')).rejects.toMatchObject({ failure: CloudFailure.NotSignedIn });
  });

  it('maps other failures to the status and server message', async () => {
    const { api } = recorder(500, { error: 'boom' });

    const error = await api.liveSessions().catch((e: CloudError) => e);

    expect(error).toMatchObject({ failure: CloudFailure.Http, status: 500, message: 'boom' });
  });
});
