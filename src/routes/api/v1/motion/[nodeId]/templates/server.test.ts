import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { TrackKind } from '$lib/motion/components';
import { appendRevision, readHead } from '$lib/server/repos/motion-revisions';
import { revisionsDb } from '$lib/server/repos/motion-revisions.test';

const ORG = 'org-1';
const NODE = 'node-1';

const state = vi.hoisted(() => ({ writeAllowed: true, db: null as unknown }));

vi.mock('$lib/server/org-data/auth', () => ({ resolveOrgCaller: async () => ({ caller: { db: state.db, orgId: ORG, userId: 'u-1', writeAllowed: state.writeAllowed } }) }));
vi.mock('$lib/server/repos/motion-templates', () => ({ listOrgTemplates: async () => [], insertOrgTemplate: vi.fn(), deleteOrgTemplate: vi.fn() }));
vi.mock('$lib/server/motion/sfx', () => ({ laySfx: async (_db: unknown, _scope: unknown, sfx: string) => ({ ok: true, assetId: `sfx-${sfx}`, url: null, seconds: 0.1 }) }));
vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/canvas')>()),
  patchNodeData: vi.fn(async () => ({ ok: true })),
  findNode: async (_db: unknown, input: { orgId: string; nodeId: string }) =>
    input.orgId === ORG && input.nodeId === NODE ? { id: NODE, canvasId: 'c-1', projectId: 'p-1', type: 'motion', displayName: 'Trailer', data: { format: '16:9' }, version: 1 } : null
}));

const { POST } = await import('./+server');
const { GET } = await import('../../templates/+server');

const post = (nodeId: string, body: unknown) => {
  const url = new URL(`https://feega.test/api/v1/motion/${nodeId}/templates`);
  return POST({ request: new Request(url, { method: 'POST', headers: { authorization: 'Bearer t' }, body: JSON.stringify(body) }), params: { nodeId }, url } as never);
};

beforeEach(async () => {
  const fake = revisionsDb();
  state.db = fake.db;
  state.writeAllowed = true;
  await appendRevision(fake.db, { orgId: ORG, nodeId: NODE, expectedVersion: 0, doc: newMotionDoc(MotionFormat.Landscape), actor: { kind: 'user', id: 'u-1' }, summary: 'start' });
});

describe('/api/v1/motion templates', () => {
  it('GET lists the templates with their field schema', async () => {
    const url = new URL('https://feega.test/api/v1/motion/templates');
    const body = await (await GET({ request: new Request(url, { headers: { authorization: 'Bearer t' } }), url } as never)).json();
    const prompt = body.templates.find((t: { id: string }) => t.id === 'builtin:prompt-input');

    expect(prompt.fields).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'accent', type: 'color', group: 'Style' })]));
  });

  it('POST inserts an editable copy with its fields and sounds, as a new revision', async () => {
    const res = await post(NODE, { id: 'builtin:prompt-input', at: 1, vars: { text: 'Zqx from the api', shape: 'pill' } });
    const body = await res.json();
    const head = await readHead(state.db as never, { orgId: ORG, nodeId: NODE });
    const doc = head?.doc as MotionDoc;

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ version: 2, clip_id: expect.any(String), sounds: null });
    expect(JSON.stringify(doc.comps)).toContain('Zqx from the api');
    expect(doc.tracks.filter((t) => t.kind === TrackKind.Audio).flatMap((t) => t.clips).length).toBeGreaterThan(15);
  });

  it('lists and inserts the feature scroll', async () => {
    const url = new URL('https://feega.test/api/v1/motion/templates');
    const body = await (await GET({ request: new Request(url, { headers: { authorization: 'Bearer t' } }), url } as never)).json();
    const scroll = body.templates.find((t: { id: string }) => t.id === 'builtin:feature-scroll');
    const res = await post(NODE, { id: 'builtin:feature-scroll', vars: { close_title: 'Zqx the end' } });
    const head = await readHead(state.db as never, { orgId: ORG, nodeId: NODE });

    expect(scroll.fields).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'lines', group: 'Text' }), expect.objectContaining({ key: 'font', group: 'Style' }), expect.objectContaining({ key: 'read_speed', group: 'Motion' })]));
    expect(res.status).toBe(200);
    expect(JSON.stringify((head?.doc as MotionDoc).comps)).toContain('Zqx the end');
  });

  it('lists and inserts the split headline', async () => {
    const url = new URL('https://feega.test/api/v1/motion/templates');
    const body = await (await GET({ request: new Request(url, { headers: { authorization: 'Bearer t' } }), url } as never)).json();
    const split = body.templates.find((t: { id: string }) => t.id === 'builtin:split-headline');
    const res = await post(NODE, { id: 'builtin:split-headline', vars: { headline: 'Zqx split here' } });
    const head = await readHead(state.db as never, { orgId: ORG, nodeId: NODE });

    expect(split.fields).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'headline', group: 'Text' }), expect.objectContaining({ key: 'radius', group: 'Style' }), expect.objectContaining({ key: 'open_seconds', group: 'Motion' })]));
    expect(res.status).toBe(200);
    expect(JSON.stringify((head?.doc as MotionDoc).comps)).toContain('Zqx split here');
  });

  it('lists and inserts the image globe', async () => {
    const url = new URL('https://feega.test/api/v1/motion/templates');
    const body = await (await GET({ request: new Request(url, { headers: { authorization: 'Bearer t' } }), url } as never)).json();
    const globe = body.templates.find((t: { id: string }) => t.id === 'builtin:image-globe');
    const res = await post(NODE, { id: 'builtin:image-globe', vars: { title: 'Zqx in front' } });
    const head = await readHead(state.db as never, { orgId: ORG, nodeId: NODE });

    expect(globe.fields).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'media', group: 'Media' }), expect.objectContaining({ key: 'turns', group: 'Motion' })]));
    expect(res.status).toBe(200);
    expect(JSON.stringify((head?.doc as MotionDoc).comps)).toContain('Zqx in front');
  });

  it('lists and inserts the comment grid', async () => {
    const url = new URL('https://feega.test/api/v1/motion/templates');
    const body = await (await GET({ request: new Request(url, { headers: { authorization: 'Bearer t' } }), url } as never)).json();
    const grid = body.templates.find((t: { id: string }) => t.id === 'builtin:comment-grid');
    const res = await post(NODE, { id: 'builtin:comment-grid', vars: { title: 'Zqx said so' } });
    const head = await readHead(state.db as never, { orgId: ORG, nodeId: NODE });

    expect(grid.fields).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'avatars', group: 'Media' }), expect.objectContaining({ key: 'comments', group: 'Text' })]));
    expect(res.status).toBe(200);
    expect(JSON.stringify((head?.doc as MotionDoc).comps)).toContain('Zqx said so');
  });

  it('lists and inserts the parallax grid', async () => {
    const url = new URL('https://feega.test/api/v1/motion/templates');
    const body = await (await GET({ request: new Request(url, { headers: { authorization: 'Bearer t' } }), url } as never)).json();
    const grid = body.templates.find((t: { id: string }) => t.id === 'builtin:parallax-grid');
    const res = await post(NODE, { id: 'builtin:parallax-grid', vars: { title: 'Zqx over the grid', motion: 'zoom' } });
    const head = await readHead(state.db as never, { orgId: ORG, nodeId: NODE });

    expect(grid.fields).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'media', group: 'Media' }), expect.objectContaining({ key: 'motion', group: 'Motion' }), expect.objectContaining({ key: 'columns', group: 'Grid' })]));
    expect(res.status).toBe(200);
    expect(JSON.stringify((head?.doc as MotionDoc).comps)).toContain('Zqx over the grid');
  });

  it('POST refuses an unknown template, a bad value and a read-only key', async () => {
    expect((await post(NODE, { id: 'builtin:nope' })).status).toBe(404);
    expect((await post(NODE, { id: 'builtin:prompt-input', vars: { theme: 'sepia' } })).status).toBe(400);
    state.writeAllowed = false;
    expect((await post(NODE, { id: 'builtin:prompt-input' })).status).toBe(403);
  });
});
