import { describe, expect, it, vi } from 'vitest';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import type { FrameStore, StoredFrame } from '$lib/server/motion/move-element';
import { FigmaOutcome } from './import-images';
import { importFigmaFrames } from './import-frames';
import type { RestNode } from './rest-message';
import type { ProviderCall } from '$lib/server/connections/account-links';

const FILE = 'AbCdEf1234567890';
const LINK = `https://www.figma.com/design/${FILE}/Kit?node-id=1-2`;
const IMAGE_REF = 'ab'.repeat(20);
const PLACE = { projectId: 'p1', canvasId: 'c1' };

const hero: RestNode = {
  id: '1:2',
  name: 'Hero',
  type: 'FRAME',
  size: { x: 400, y: 300 },
  relativeTransform: [[1, 0, 0], [0, 1, 0]],
  children: [{ id: '1:3', name: 'Photo', type: 'RECTANGLE', size: { x: 100, y: 100 }, relativeTransform: [[1, 0, 0], [0, 1, 0]], fills: [{ type: 'IMAGE', imageRef: IMAGE_REF }] }]
};

const json = (status: number, data: unknown) => ({ status, data, headers: {}, file: null });

function memoryStore() {
  const frames = new Map<string, StoredFrame>();
  const store = {
    create: vi.fn(async (at, doc) => {
      const id = `frame-${frames.size + 1}`;
      frames.set(id, { nodeId: id, projectId: at.projectId, canvasId: at.canvasId, version: 1, doc });
      return id;
    }),
    read: vi.fn(async (id: string) => frames.get(id) ?? null),
    write: vi.fn(async (id: string, version: number, doc) => {
      frames.set(id, { ...frames.get(id)!, version: version + 1, doc });
      return { outcome: RevisionOutcome.Written, head: {} } as never;
    }),
    remove: vi.fn(),
    output: vi.fn()
  } as unknown as FrameStore;
  return { store, frames };
}

function figma(overrides: Record<string, () => ReturnType<typeof json>> = {}) {
  return vi.fn(async (request: ProviderCall) => {
    const route = Object.keys(overrides).find((r) => request.endpoint.endsWith(r));
    if (route) {
      return overrides[route]();
    }
    if (request.endpoint.endsWith('/nodes')) {
      return json(200, { nodes: { '1:2': { document: hero } } });
    }
    return json(200, { meta: { images: { [IMAGE_REF]: 'https://s3/photo.png' } } });
  });
}

const run = (over: Partial<Parameters<typeof importFigmaFrames>[0]> = {}) => {
  const { store, frames } = memoryStore();
  const importUrl = vi.fn(async () => 'asset-1');
  const call = figma();
  const ask = { url: LINK, nodeIds: null, at: { x: 1000, y: 500 } };
  const deps = { store, place: PLACE, call, importUrl, newId: () => 'id' };
  return { frames, importUrl, call, done: importFigmaFrames({ ...deps, ...ask, ...over }) };
};

describe('importing Figma frames by link', () => {
  it('draws the frame the link points at, centred where asked', async () => {
    const { done, frames } = run();

    const result = await done;

    expect(result).toMatchObject({ outcome: FigmaOutcome.Ok, frameIds: ['frame-1'] });
    expect(frames.size).toBe(1);
  });

  it('draws the frames the user picked instead of the one in the link', async () => {
    const { done, call } = run({ nodeIds: ['1:2'] });

    await done;

    expect(call).toHaveBeenCalledWith(expect.objectContaining({ query: expect.objectContaining({ ids: '1:2' }) }));
  });

  it('fills the image placeholders with the pictures stored from Figma', async () => {
    const { done, frames, importUrl } = run();

    await done;

    expect(importUrl).toHaveBeenCalledWith('https://s3/photo.png');
    expect(JSON.stringify(frames.get('frame-1')!.doc)).toContain('asset-1');
  });

  it('keeps the frame, with placeholders, when the pictures cannot be fetched', async () => {
    const { done, frames } = run({ call: figma({ '/images': () => json(500, {}) }) });

    const result = await done;

    expect(result).toMatchObject({ outcome: FigmaOutcome.Ok });
    expect(frames.size).toBe(1);
  });

  it('says why nothing was drawn', async () => {
    expect((await run({ call: null }).done).outcome).toBe(FigmaOutcome.NoToken);
    expect((await run({ url: 'https://example.com/x' }).done).outcome).toBe(FigmaOutcome.BadLink);
    expect((await run({ url: `https://www.figma.com/design/${FILE}/Kit` }).done).outcome).toBe(FigmaOutcome.NoFrames);
    expect((await run({ call: figma({ '/nodes': () => json(403, {}) }) }).done).outcome).toBe(FigmaOutcome.Rejected);
    expect((await run({ call: figma({ '/nodes': () => json(200, { nodes: { '1:2': null } }) }) }).done).outcome).toBe(FigmaOutcome.Unreadable);
  });
});
