import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectMode } from '$lib/project-mode';

const ORG = 'org-1';
const NODE = '11111111-2222-4333-8444-555555555555';

const store = vi.hoisted(() => ({
  caller: null as null | Record<string, unknown>,
  head: 2 as number | null,
  mode: 'standard',
  playback: 'autoplay',
  files: new Map<string, string>()
}));

const bucket = {
  upload: async (path: string, blob: Blob) => {
    store.files.set(path, await blob.text());
    return { error: null };
  },
  remove: async (paths: string[]) => {
    paths.forEach((p) => store.files.delete(p));
    return { error: null };
  },
  list: async () => ({ data: [...store.files.keys()].map((name) => ({ name })) })
};

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => (store.caller ? { caller: store.caller } : { error: { status: 401, body: { error: 'unauthenticated' } } }) }));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()),
  findNode: async (_db: unknown, input: { orgId: string; nodeId: string }) =>
    input.orgId === ORG && input.nodeId === NODE
      ? { id: NODE, projectId: 'p-1', canvasId: 'c-1', type: 'motion', displayName: 'Launch', data: { format: '16:9', docHeadRevision: store.head ?? 0, posterAssetId: null, lastRenderAssetId: null } }
      : null
}));
vi.mock('$lib/server/repos/projects', () => ({ findProjectById: async () => ({ id: 'p-1', brandId: null, mode: store.mode }) }));
vi.mock('$lib/server/repos/assets', () => ({ listProjectAssets: async () => [] }));
vi.mock('$lib/server/canvas/sign-media', () => ({ createAssetSigningDb: () => ({}), signAssetPaths: async () => new Map() }));
vi.mock('$lib/server/repos/motion-revisions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/motion-revisions')>()),
  readHead: async () => {
    if (!store.head) {
      return null;
    }
    const { newMotionDoc, MotionFormat } = await import('$lib/motion/doc');
    return { version: store.head, doc: { ...newMotionDoc(MotionFormat.Landscape), interactive: { loop: false, outside: 'fallback', playback: store.playback } }, summary: null, actorKind: 'user' };
  }
}));

const route = await import('./+server');
const { GET: BUNDLE } = await import('./bundle/+server');

type Handler = (event: never) => Promise<Response>;

const call = (handler: Handler, method: string, path = 'embed') => {
  const url = new URL(`https://feega.app/api/v1/motion/${NODE}/${path}`);
  return handler({ request: new Request(url, { method, headers: { authorization: 'Bearer k' } }), params: { nodeId: NODE }, url } as never);
};

beforeEach(() => {
  store.caller = { db: { storage: { from: () => bucket } }, orgId: ORG, userId: 'u-1', apiKeyId: 'key-1', writeAllowed: true };
  store.head = 2;
  store.mode = ProjectMode.Standard;
  store.playback = 'autoplay';
  store.files.clear();
});

describe('/api/v1/motion/[nodeId]/embed', () => {
  it('publishes the saved video and returns the snippet and public url', async () => {
    const res = await call(route.POST as Handler, 'POST');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe(`https://feega.app/e/${NODE}`);
    expect(body.snippet).toBe(`<script src="https://feega.app/embed.js" async></script>\n<feega-motion src="${NODE}"></feega-motion>`);
    expect(body.revision).toBe(2);
    expect(store.files.get(`${NODE}.html`)).toContain('<html');
  });

  it('reports whether it is published, with the snippet', async () => {
    expect(await (await call(route.GET as Handler, 'GET')).json()).toMatchObject({ published: false, url: `https://feega.app/e/${NODE}` });
    await call(route.POST as Handler, 'POST');

    const after = await (await call(route.GET as Handler, 'GET')).json();
    expect(after.published).toBe(true);
    expect(after.snippet).toBe(`<script src="https://feega.app/embed.js" async></script>\n<feega-motion src="${NODE}"></feega-motion>`);
  });

  it('hands a scrub video the same two-line snippet: the scroll story is built by the loader', async () => {
    store.playback = 'scrub';
    const published = await (await call(route.POST as Handler, 'POST')).json();
    const read = await (await call(route.GET as Handler, 'GET')).json();

    expect(published.snippet).not.toContain('data-scroll');
    expect(read.snippet).toBe(published.snippet);
  });

  it('unpublishes', async () => {
    await call(route.POST as Handler, 'POST');
    const res = await call(route.DELETE as Handler, 'DELETE');
    expect(res.status).toBe(200);
    expect(store.files.size).toBe(0);
  });

  it('refuses an uncensored project', async () => {
    store.mode = ProjectMode.Uncensored;
    const res = await call(route.POST as Handler, 'POST');
    expect(res.status).toBe(403);
    expect((await res.json()).refusal).toBeDefined();
    expect(store.files.size).toBe(0);
  });

  it('refuses a video with nothing saved', async () => {
    store.head = null;
    expect((await call(route.POST as Handler, 'POST')).status).toBe(409);
  });

  it('refuses a read-only key', async () => {
    store.caller = { ...store.caller, writeAllowed: false };
    expect((await call(route.POST as Handler, 'POST')).status).toBe(403);
    expect((await call(route.DELETE as Handler, 'DELETE')).status).toBe(403);
  });

  it('hides a node of another org', async () => {
    store.caller = { ...store.caller, orgId: 'org-2' };
    expect((await call(route.POST as Handler, 'POST')).status).toBe(404);
    expect((await call(route.GET as Handler, 'GET')).status).toBe(404);
  });
});

describe('/api/v1/motion/[nodeId]/embed/bundle', () => {
  it('downloads the self-contained html', async () => {
    const res = await call(BUNDLE as Handler, 'GET', 'embed/bundle');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('content-disposition')).toContain('attachment');
    expect(await res.text()).toContain('<html');
  });
});
