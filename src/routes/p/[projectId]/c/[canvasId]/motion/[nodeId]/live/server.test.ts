import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MotionFormat, newClip, newMotionDoc } from '$lib/motion/doc';
import { defaultProps } from '$lib/motion/components';
import { LIVE_MESSAGE } from '$lib/motion/interactive/live-bridge';

const state = vi.hoisted(() => ({ head: null as null | Record<string, unknown> }));

vi.mock('$lib/server/motion/editor-scope', () => ({
  motionScope: async () => ({
    db: {},
    userId: 'u-1',
    orgId: 'org-1',
    canvas: { id: 'c-1', name: 'Canvas' },
    projectBrandId: null,
    motion: { record: { id: 'n-1' }, node: { id: 'n-1', format: '9:16', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } }
  })
}));
vi.mock('$lib/server/repos/motion-revisions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/repos/motion-revisions')>()),
  readHead: async () => state.head
}));
vi.mock('$lib/server/motion/editor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('$lib/server/motion/editor')>()),
  motionAssets: async () => []
}));

const { GET } = await import('./+server');

function titled(text: string) {
  const doc = newMotionDoc(MotionFormat.Landscape);
  doc.durationInFrames = 90;
  doc.tracks[0].clips.push(newClip({ id: 't', from: 0, durationInFrames: 90, component: 'Title', props: { ...defaultProps('Title'), text } }) as never);
  return doc;
}

async function read() {
  const params = { projectId: 'p-1', canvasId: 'c-1', nodeId: 'n-1' };
  const res = await GET({ locals: {}, params, url: new URL('https://oh.feega.test/p/p-1/c/c-1/motion/n-1/live') } as unknown as Parameters<typeof GET>[0]);
  return { status: res.status, type: res.headers.get('content-type'), body: await res.text() };
}

beforeEach(() => {
  state.head = null;
});

describe('GET motion live', () => {
  it('serves the current revision as a running interactive page, with the bridge back to the canvas', async () => {
    state.head = { version: 3, doc: titled('Launch day'), summary: null, actorKind: 'user' };

    const { status, type, body } = await read();

    expect(status).toBe(200);
    expect(type).toContain('text/html');
    expect(body).toContain('Launch day');
    expect(body).toContain('<hyperframes-player id="player"');
    expect(body).toContain(LIVE_MESSAGE);
  });
});
