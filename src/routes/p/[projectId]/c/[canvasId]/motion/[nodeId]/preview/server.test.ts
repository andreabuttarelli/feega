import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MotionFormat, newClip, newMotionDoc } from '$lib/motion/doc';
import { defaultProps } from '$lib/motion/components';

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
  const res = await GET({ locals: {}, params } as unknown as Parameters<typeof GET>[0]);
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  state.head = null;
});

describe('GET motion preview', () => {
  it('plays the current revision of the video, not an empty frame', async () => {
    state.head = { version: 3, doc: titled('Launch day'), summary: null, actorKind: 'user' };

    const { status, body } = await read();

    expect(status).toBe(200);
    expect(body).toMatchObject({ version: 3, width: 1920, height: 1080, fps: 30, durationInFrames: 90 });
    expect(body.html).toContain('Launch day');
  });

  it('a video never saved previews the empty doc of its format', async () => {
    const { body } = await read();

    expect(body).toMatchObject({ version: 0, width: 1080, height: 1920 });
    expect(body.html).toContain('<html');
  });
});
