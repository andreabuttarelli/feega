import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { addClip, type OpResult } from '@feega/motion-core/motion/timeline';
import type { Db } from '$lib/server/db/client';
import { createMemoryDb } from '$lib/server/local/memory-db';
import { createNode, deleteNode, findNode } from '$lib/server/repos/canvas';
import type { Actor } from '$lib/server/repos/actor';
import { createComponent, instanceOf, overrideInstance } from '$lib/motion/main-component';
import { homed, placeInstance } from '$lib/motion/canvas-components';
import { headOrNew, saveMotionDoc } from './editor';
import { frameCode } from './code-export';
import { motionSource } from './sources';

const ORG = 'org';
const USER: Actor = { kind: 'user', id: 'u1' };
const MOTION_DATA = { format: 'landscape', docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null };
const FORMAT = { format: MotionFormat.Landscape };

const must = (r: OpResult): MotionDoc => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

function memory(): Db {
  return createMemoryDb({ tables: new Map(), blobs: new Map(), user: { id: 'u1', email: 'a@b.c', created_at: '2026-01-01' }, storageUrl: () => '', onChange: () => {} }) as unknown as Db;
}

const clipsOf = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips as MotionClip[]);

const relabel = (doc: MotionDoc, compId: string, text: string): MotionDoc => ({
  ...doc,
  comps: { ...doc.comps, [compId]: { ...doc.comps[compId], tracks: doc.comps[compId].tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => ({ ...c, props: { ...c.props, text } })) })) } }
});

const innerText = (doc: MotionDoc, compId: string) => (doc.comps[compId].tracks[0].clips[0] as MotionClip).props.text;

async function frame(db: Db, canvasId: string) {
  return createNode(db, { orgId: ORG, projectId: 'p', canvasId, type: 'motion', x: 0, y: 0, data: MOTION_DATA, actor: USER });
}

const save = (db: Db, nodeId: string, expectedVersion: number, doc: MotionDoc) => saveMotionDoc(db, { orgId: ORG, nodeId, expectedVersion, doc, actor: USER });

async function project() {
  const db = memory();
  const [a, b] = [await frame(db, 'canvas-a'), await frame(db, 'canvas-b')];
  const base = must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 90, props: { text: 'Buy now' } }, 'label'));
  const main = must(createComponent(base, ['label'], () => 'button', 'Button'));
  const compId = String(clipsOf(main)[0].props.comp);
  const copy = must(placeInstance(newMotionDoc(MotionFormat.Landscape), homed(main, a.id), compId, () => 'inst'));
  await save(db, a.id, 0, main);
  await save(db, b.id, 0, must(overrideInstance(copy, 'inst', 'label', { fills: [] })));
  return { db, a, b, main, compId };
}

describe('an instance on another canvas depends on its main', () => {
  it('reads the main as it is now, keeping the instance overrides', async () => {
    const { db, a, b, main, compId } = await project();

    await save(db, a.id, 1, relabel(main, compId, 'Order'));
    const head = await headOrNew(db, { orgId: ORG, nodeId: b.id }, FORMAT);

    expect(innerText(head.doc, compId)).toBe('Order');
    expect(instanceOf(head.doc, 'inst')!.overrides).toEqual({ label: { fills: [] } });
    expect(head.version).toBe(1);
  });

  it('renders the canvas from the resolved instance', async () => {
    const { db, a, b, main, compId } = await project();

    await save(db, a.id, 1, relabel(main, compId, 'Order'));
    const signed = { db, orgId: ORG, projectId: 'p', canvasId: 'canvas-b', nodeId: b.id, sign: async () => new Map<string, string>() };
    const source = await motionSource(signed);

    expect(innerText(source!.doc, compId)).toBe('Order');
  });

  it('exports code from the resolved instance', async () => {
    const { db, a, b, main, compId } = await project();

    await save(db, a.id, 1, relabel(main, compId, 'Order'));
    const code = await frameCode(db, { orgId: ORG, nodeId: b.id, target: 'html', sign: async () => new Map() });

    expect(JSON.stringify(code)).toContain('Order');
    expect(JSON.stringify(code)).not.toContain('Buy now');
  });

  it('nudges the frames holding an instance when the main changes, so open canvases refetch', async () => {
    const { db, a, b, main, compId } = await project();
    const before = (await findNode(db, { orgId: ORG, nodeId: b.id }))!;

    await save(db, a.id, 1, relabel(main, compId, 'Order'));
    const after = (await findNode(db, { orgId: ORG, nodeId: b.id }))!;

    expect(before.data.mainHomes).toEqual([a.id]);
    expect(after.data.linked).not.toEqual(before.data.linked);
  });

  it('does not touch the frames holding an instance when the main did not change', async () => {
    const { db, a, b, main } = await project();
    await save(db, a.id, 1, main);
    const before = (await findNode(db, { orgId: ORG, nodeId: b.id }))!;

    await save(db, a.id, 2, main);

    expect((await findNode(db, { orgId: ORG, nodeId: b.id }))!.version).toBe(before.version);
  });

  it('detaches the instance, keeping its last look, when the home frame is deleted', async () => {
    const { db, a, b, compId } = await project();

    await deleteNode(db, { orgId: ORG, nodeId: a.id, actor: USER });
    const head = await headOrNew(db, { orgId: ORG, nodeId: b.id }, FORMAT);

    expect(instanceOf(head.doc, 'inst')).toBeNull();
    expect(innerText(head.doc, String(clipsOf(head.doc)[0].props.comp))).toBe('Buy now');
    expect(compId).toBe('button');
  });
});
