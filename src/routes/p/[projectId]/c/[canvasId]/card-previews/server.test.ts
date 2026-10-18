import { beforeEach, describe, expect, it, vi } from 'vitest';

const ORG = 'org-1';
const HASH = 'c'.repeat(64);
const list = vi.fn();
const save = vi.fn();

vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [] }));
vi.mock('$lib/server/canvas/lookup', () => ({
  findCanvasForUser: async (_db: unknown, input: { canvasId: string }) => (input.canvasId === 'c-1' ? { orgId: ORG, canvas: { id: 'c-1', projectId: 'p-1' } } : null)
}));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasReachable: async () => true }));
vi.mock('$lib/server/canvas/card-previews', () => ({ cardPreviews: (...a: unknown[]) => list(...a), saveCardPreview: (...a: unknown[]) => save(...a) }));

const { GET, POST } = await import('./+server');

const locals = (user: unknown = { id: 'u-1' }) => ({ safeGetSession: async () => ({ user }), db: async () => ({}) });
const event = (canvasId: string, init?: { body: FormData }, user?: unknown) =>
  ({ locals: locals(user), params: { projectId: 'p-1', canvasId }, request: new Request(`https://feega.test/p/p-1/c/${canvasId}/card-previews`, init ? { method: 'POST', body: init.body } : undefined) }) as never;

const form = (fields: Record<string, string | File>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    f.set(k, v);
  }
  return f;
};
const webp = (bytes = 3) => new File([new Uint8Array(bytes)], 'card.webp', { type: 'image/webp' });

beforeEach(() => {
  list.mockReset().mockResolvedValue({ n1: { hash: HASH, url: 'https://signed/x' } });
  save.mockReset().mockResolvedValue(undefined);
});

describe('card previews endpoint', () => {
  it('lists the previews of the canvas’s project', async () => {
    const body = await (await GET(event('c-1'))).json();
    expect(body).toEqual({ n1: { hash: HASH, url: 'https://signed/x' } });
    expect(list.mock.calls[0][1]).toEqual({ orgId: ORG, projectId: 'p-1' });
  });

  it('stores a rasterised card under its node and key', async () => {
    const file = webp();
    const res = await POST(event('c-1', { body: form({ nodeId: 'n1', hash: HASH, file }) }));
    expect(res.status).toBe(204);
    expect(save.mock.calls[0][1]).toMatchObject({ orgId: ORG, projectId: 'p-1', nodeId: 'n1', hash: HASH });
  });

  it('refuses what is not a small webp', async () => {
    await expect(POST(event('c-1', { body: form({ nodeId: 'n1', hash: HASH, file: new File(['x'], 'a.png', { type: 'image/png' }) }) }))).rejects.toMatchObject({ status: 400 });
    await expect(POST(event('c-1', { body: form({ nodeId: 'n1', hash: HASH, file: webp(2_000_001) }) }))).rejects.toMatchObject({ status: 400 });
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses a stranger and a canvas that is not theirs', async () => {
    await expect(GET(event('c-1', undefined, null))).rejects.toMatchObject({ status: 401 });
    await expect(GET(event('c-9'))).rejects.toMatchObject({ status: 404 });
    expect(list).not.toHaveBeenCalled();
  });
});
