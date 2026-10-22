import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { setStill } from '$lib/motion/still';

const insertAsset = vi.fn();
const shots: { viewport: unknown; mime: string; seek: number }[] = [];
const pinned = setStill(newMotionDoc(MotionFormat.Poster), 1);

vi.mock('$lib/server/repos/assets', async (original) => ({ ...(await original<object>()), insertAsset }));
vi.mock('$lib/server/repos/orgs', () => ({ listMemberships: async () => [] }));
const lookupFound = () => ({ orgId: 'org-a', canvas: { id: 'c1', projectId: 'p1', name: 'C' }, projectBrandId: null });
vi.mock('$lib/server/canvas/lookup', () => ({ findCanvasForUser: async () => lookupFound(), openCanvasForUser: async () => ({ memberships: [], found: lookupFound() }) }));
vi.mock('$lib/server/uncensored-workspace/workspace-server', () => ({ canvasReachable: async () => true }));
vi.mock('$lib/server/motion/editor', async (original) => ({
  ...(await original<object>()),
  findMotionNode: async () => ({ record: { id: 'n1' }, node: {} }),
  headOrNew: async () => ({ version: 3, doc: pinned.ok ? pinned.doc : null }),
  motionAssets: async () => [],
  motionTokens: async () => (await import('$lib/motion/brand')).FEEGA_TOKENS
}));
vi.mock('$lib/server/motion/chromium-frames', () => ({
  serverFramesOpen: () => true,
  chromiumFrames: {
    open: async (viewport: unknown) => {
      let seek = -1;
      return {
        load: async () => {},
        seek: async (s: number) => {
          seek = s;
        },
        jpeg: async () => Buffer.from(''),
        picture: async (mime: string) => {
          shots.push({ viewport, mime, seek });
          return Buffer.from('png-bytes');
        },
        close: async () => {}
      };
    }
  }
}));

const { actions } = await import('$lib/server/frame-editor/editor-page');

function fakeDb() {
  const uploads: { path: string; type: string }[] = [];
  const bucket = {
    upload: async (path: string, file: File) => {
      uploads.push({ path, type: file.type });
      return { error: null };
    },
    createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://files/${path}` }, error: null })
  };
  return { db: { storage: { from: () => bucket } }, uploads };
}

function event(db: unknown, fields: Record<string, string>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    form.set(k, v);
  }
  return {
    locals: { safeGetSession: async () => ({ session: {}, user: { id: 'u1' } }), db: async () => db },
    params: { projectId: 'p1', canvasId: 'c1', nodeId: 'n1' },
    request: new Request('http://x', { method: 'POST', body: form })
  } as never;
}

describe('the editor exports its still as an image', () => {
  beforeEach(() => {
    shots.length = 0;
    insertAsset.mockReset();
    insertAsset.mockResolvedValue({ id: 'still-1' });
  });

  it('draws the saved still at 2x as a PNG, stores it as a project image and answers its url', async () => {
    const { db, uploads } = fakeDb();

    const out = (await actions.still(event(db, { format: 'png', scale: '2' }))) as Record<string, unknown>;

    expect(shots).toEqual([{ viewport: { width: 1080, height: 1527, scale: 2 }, mime: 'image/png', seek: 1 }]);
    expect(uploads[0]).toMatchObject({ type: 'image/png', path: expect.stringMatching(/^org-a\/p1\/stills\/.+\.png$/) });
    expect(insertAsset).toHaveBeenCalledWith(db, expect.objectContaining({ projectId: 'p1', type: 'image', width: 2160, height: 3054, sourceNodeId: 'n1' }));
    expect(out).toMatchObject({ ok: true, asset_id: 'still-1', width: 2160, url: expect.stringContaining('https://files/') });
  });

  it('a format it does not know is refused before anything is drawn', async () => {
    const { db } = fakeDb();

    const out = (await actions.still(event(db, { format: 'tiff' }))) as { status?: number };

    expect(out.status).toBe(400);
    expect(shots).toEqual([]);
  });
});
