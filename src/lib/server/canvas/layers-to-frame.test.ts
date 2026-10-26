import { describe, expect, it, vi } from 'vitest';
import { layersToFrame, type LayersToFrameDeps } from './layers-to-frame';

const db = {} as never;
const SCOPE = { orgId: 'org', nodeId: 'n-layers' };

const node = {
  id: 'n-layers',
  canvasId: 'c1',
  projectId: 'p1',
  type: 'image',
  displayName: 'Layers',
  position: { x: 500, y: 40, z: 0 },
  size: { width: 320, height: 240 },
  version: 4,
  data: {
    refId: 'a-base',
    layerRefIds: ['a-title', 'a-parrot'],
    layerBoxes: [
      { label: 'title', box: { left: 0.1, top: 0.05, width: 0.8, height: 0.15 } },
      { label: 'parrot', box: { left: 0.33, top: 0.274, width: 0.311, height: 0.717 } }
    ]
  }
};

const asset = (id: string) => ({ id, type: 'image', width: 800, height: 600 });

function deps(over: Partial<LayersToFrameDeps> = {}): LayersToFrameDeps {
  return {
    findNode: vi.fn(async () => node),
    findAssets: vi.fn(async () => new Map(['a-base', 'a-title', 'a-parrot'].map((id) => [id, asset(id)]))),
    createFrame: vi.fn(async () => 'frame-1'),
    ...over
  } as unknown as LayersToFrameDeps;
}

describe('layersToFrame', () => {
  it('makes one frame to the right of the node with the base and every layer as image elements', async () => {
    const d = deps();

    const out = await layersToFrame(db, d, SCOPE);

    expect(out).toEqual({ ok: true, frameId: 'frame-1' });
    const [place, doc] = (d.createFrame as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(place).toMatchObject({ projectId: 'p1', canvasId: 'c1', y: 40 });
    expect(place.x).toBeGreaterThan(500 + 320);
    const clips = doc.tracks.flatMap((t: { clips: { props: Record<string, unknown> }[] }) => t.clips).filter((c: { component: string }) => c.component === 'Image');
    expect(clips.map((c: { props: Record<string, unknown> }) => c.props.assetId).sort()).toEqual(['a-base', 'a-parrot', 'a-title']);
  });

  it('refuses a node that is missing, not an image, or has no layers, before writing', async () => {
    for (const [found, error] of [
      [null, 'node_not_found'],
      [{ ...node, type: 'text' }, 'source_not_image'],
      [{ ...node, data: { refId: 'a-base' } }, 'no_layers']
    ] as const) {
      const d = deps({ findNode: vi.fn(async () => found) as never });

      expect(await layersToFrame(db, d, SCOPE)).toEqual({ ok: false, error });
      expect(d.createFrame).not.toHaveBeenCalled();
    }
  });

  it('keeps only the layers whose box and file are both known', async () => {
    const d = deps({ findAssets: vi.fn(async () => new Map(['a-base', 'a-title'].map((id) => [id, asset(id)]))) as never });

    await layersToFrame(db, d, SCOPE);

    const doc = (d.createFrame as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(doc.tracks.flatMap((t: { clips: unknown[] }) => t.clips).filter((c: { component: string }) => c.component === 'Image')).toHaveLength(2);
  });
});
