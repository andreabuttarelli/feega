import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { readSharedPrototype, type PrototypePorts } from './prototype-share';
import { setFlow } from '$lib/motion/prototype/flows';

const CANVAS = { id: 'canvas-1', org_id: 'org-1', project_id: 'project-1', name: 'Launch', share_token: 'tok-live', deleted_at: null };

function node(id: string, name: string, y: number, type = 'motion', deleted_at: string | null = null) {
  return { id, canvas_id: 'canvas-1', project_id: 'project-1', org_id: 'org-1', type, display_name: name, x: 0, y, z: 0, width: null, height: null, data: {}, version: 1, deleted_at };
}

const flowed = (name: string): MotionDoc => {
  const set = setFlow(newMotionDoc(MotionFormat.Landscape), name);
  if (!set.ok) {
    throw new Error(set.error);
  }
  return set.doc;
};

const docs: Record<string, MotionDoc> = { a: newMotionDoc(MotionFormat.Landscape), b: flowed('Checkout'), c: newMotionDoc(MotionFormat.Landscape) };

function ports(published: string[]): PrototypePorts {
  return {
    db: fakeDb(
      {
        canvases: [CANVAS],
        projects: [{ id: 'project-1', org_id: 'org-1', mode: 'standard' }],
        nodes: [node('a', 'Home', 0), node('b', 'Cart', 400), node('c', 'Draft', 800), node('img', 'Pic', 0, 'image'), node('gone', 'Old', 0, 'motion', '2026-09-01T00:00:00Z')]
      },
      { filter: true }
    ).db,
    isPublished: async (id) => published.includes(id),
    doc: async (id) => docs[id] ?? null,
    look: async () => ({ tokens: FEEGA_TOKENS, assets: { asset1: 'https://signed/1' } })
  };
}

describe('readSharedPrototype', () => {
  it('an unknown token reads nothing', async () => {
    expect(await readSharedPrototype(ports(['a']), 'nope', null)).toBeNull();
  });

  it('serves only published motion frames, in canvas order', async () => {
    const shared = await readSharedPrototype(ports(['a', 'b']), 'tok-live', null);

    expect(shared?.frames.map((f) => f.id)).toEqual(['a', 'b']);
    expect(shared?.canvasName).toBe('Launch');
  });

  it('carries each frame doc with the canvas look and signed assets', async () => {
    const shared = await readSharedPrototype(ports(['a']), 'tok-live', null);

    expect(shared?.frames[0]).toMatchObject({ id: 'a', name: 'Home', tokens: FEEGA_TOKENS, assets: { asset1: 'https://signed/1' } });
    expect(shared?.frames[0].doc.width).toBe(docs.a.width);
  });

  it('starts on the frame asked for, else the first flow, else the first frame', async () => {
    expect((await readSharedPrototype(ports(['a', 'b']), 'tok-live', 'a'))?.start).toBe('a');
    expect((await readSharedPrototype(ports(['a', 'b']), 'tok-live', 'c'))?.start).toBe('b');
    expect((await readSharedPrototype(ports(['a']), 'tok-live', null))?.start).toBe('a');
  });

  it('reads nothing when no frame is published', async () => {
    expect(await readSharedPrototype(ports([]), 'tok-live', null)).toBeNull();
  });
});
