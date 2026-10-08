import { describe, expect, it, vi } from 'vitest';
import type { Db } from '$lib/server/db/client';
import { RevisionOutcome } from '$lib/server/repos/motion-revisions';
import { COMPOSITION_CLIP, applyDraft, newDraft } from '$lib/motion/composition-draft';
import { findClip, newMotionDoc, MotionFormat, type MotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { motionCompId } from '$lib/motion/embed';
import { COMPOSE_DEPS, mediaOfRefs, openCanvasComposition, recentCompositions, startComposition, type ComposeDeps } from './compose';

const db = {} as Db;
const canvas = (id: string, name: string) => ({ id, projectId: 'p1', name, viewport: null });

function composedDoc(layout: Parameters<typeof newDraft>[0]): MotionDoc {
  const verdict = applyDraft(newMotionDoc(MotionFormat.Vertical), newDraft(layout));
  if (!verdict.ok) {
    throw new Error(verdict.error);
  }
  return verdict.doc;
}

function deps(overrides: Partial<ComposeDeps> = {}): ComposeDeps {
  return {
    ...COMPOSE_DEPS,
    listCanvases: vi.fn(async () => [canvas('c1', 'Board')]),
    createCanvas: vi.fn(async () => canvas('c-motion', 'Motion')),
    listNodes: vi.fn(async () => []),
    createNode: vi.fn(async (_db: Db, input: { canvasId: string }) => ({ id: 'm-new', canvasId: input.canvasId, projectId: 'p1', type: 'motion', displayName: null, position: { x: 0, y: 0, z: 0 }, size: { width: null, height: null }, data: {}, version: 1 })),
    saveMotionDoc: vi.fn(async (_db: Db, input: { doc: unknown }) => ({ outcome: RevisionOutcome.Written as const, head: { version: 1, doc: input.doc as MotionDoc, summary: null, actorKind: 'user' } })),
    listRecentNodes: vi.fn(async () => []),
    readHead: vi.fn(async () => null),
    readHeads: vi.fn(async () => new Map()),
    findNode: vi.fn(async () => null),
    listConnections: vi.fn(async () => []),
    listProjectAssets: vi.fn(async () => []),
    ...overrides
  };
}

describe('startComposition', () => {
  it('creates a motion video whose first revision is the chosen template', async () => {
    const d = deps();
    const started = await startComposition(db, d, { orgId: 'org', projectId: 'p1', canvasId: null, userId: 'u1', name: 'Spring', draft: newDraft('coverflow') });

    expect(started).toEqual({ ok: true, start: { projectId: 'p1', canvasId: 'c-motion', nodeId: 'm-new' } });
    const saved = vi.mocked(d.saveMotionDoc).mock.calls[0][1];
    expect(saved).toMatchObject({ orgId: 'org', nodeId: 'm-new', expectedVersion: 0, actor: { kind: 'user', id: 'u1' } });
    expect(findClip(saved.doc as MotionDoc, COMPOSITION_CLIP)?.clip.props).toMatchObject({ layout: 'coverflow' });
  });

  it('refuses a canvas outside the project', async () => {
    const d = deps();
    const started = await startComposition(db, d, { orgId: 'org', projectId: 'p1', canvasId: 'stranger', userId: 'u1', name: 'x', draft: newDraft('helix') });

    expect(started).toEqual({ ok: false, error: 'canvas_not_found' });
    expect(d.saveMotionDoc).not.toHaveBeenCalled();
  });
});

describe('mediaOfRefs', () => {
  it('keeps project images and videos, in order, with their kind', () => {
    const assets = [
      { id: 'a', type: 'image' as const },
      { id: 'v', type: 'video' as const },
      { id: 't', type: 'text' as const }
    ];

    expect(mediaOfRefs(assets, ['v', 'x', 't', 'a'])).toEqual([
      { assetId: 'v', kind: 'video' },
      { assetId: 'a', kind: 'image' }
    ]);
  });
});

describe('recentCompositions', () => {
  it('lists only the motion videos of the project that hold a composition', async () => {
    const node = (id: string, projectId: string) => ({ id, projectId, canvasId: 'c1', name: `video ${id}`, data: { docHeadRevision: 1 }, updatedAt: '2026-10-04' });
    const heads: Record<string, MotionDoc> = { comp: composedDoc('helix'), plain: newMotionDoc(MotionFormat.Vertical) };
    const d = deps({
      listRecentNodes: vi.fn(async () => [node('comp', 'p1'), node('plain', 'p1'), node('other', 'p2')]),
      readHeads: vi.fn(async () => new Map(Object.entries(heads).map(([id, doc]) => [id, { version: 1, doc, summary: null, actorKind: 'user' }])))
    });

    const listed = await recentCompositions(db, d, { orgId: 'org', projectId: 'p1' });

    expect(listed).toEqual([{ id: 'comp', name: 'video comp', layout: 'helix', updatedAt: '2026-10-04', href: '/app/compose/comp?project=p1', posterAssetId: null, renderAssetId: null }]);
  });
});

describe('openCanvasComposition: an existing canvas composition node becomes the same video', () => {
  const record = (id: string, type: string, data: Record<string, unknown>) => ({ id, canvasId: 'c1', projectId: 'p1', type, displayName: 'Old reel', position: { x: 0, y: 0, z: 0 }, size: { width: 320, height: 240 }, data, version: 3 });
  const legacy = record('comp-node', 'composition', { layout: 'helix', layoutParams: { turns: 3 }, camera: { preset: 'push-in', params: { endDistance: 4 } }, background: { color: '#123456' }, duration: 9, aspect: '1:1', refId: null });
  const asset = (id: string, type: string) => ({ id, type }) as never;

  function migrating(overrides: Partial<ComposeDeps> = {}) {
    return deps({
      findNode: vi.fn(async () => legacy),
      listNodes: vi.fn(async () => [legacy, record('img-1', 'image', { assetId: 'a1' }), record('vid-1', 'video', { assetId: 'v1' }), record('stray', 'image', { assetId: 'a9' })]),
      listConnections: vi.fn(async () => [
        { id: 'e1', canvasId: 'c1', sourceNodeId: 'img-1', targetNodeId: 'comp-node', sourceHandle: null, targetHandle: null, mode: 'fixed' },
        { id: 'e2', canvasId: 'c1', sourceNodeId: 'vid-1', targetNodeId: 'comp-node', sourceHandle: null, targetHandle: null, mode: 'fixed' }
      ]) as never,
      listProjectAssets: vi.fn(async () => [asset('a1', 'image'), asset('v1', 'video'), asset('a9', 'image')]),
      ...overrides
    });
  }

  it('carries every setting and the wired media into the first revision, on the same canvas', async () => {
    const d = migrating();
    const opened = await openCanvasComposition(db, d, { orgId: 'org', projectId: 'p1', canvasId: 'c1', nodeId: 'comp-node', userId: 'u1' });

    expect(opened).toEqual({ ok: true, start: { projectId: 'p1', canvasId: 'c1', nodeId: 'm-new' } });
    const doc = vi.mocked(d.saveMotionDoc).mock.calls[0][1].doc as MotionDoc;
    expect({ width: doc.width, height: doc.height, durationInFrames: doc.durationInFrames }).toEqual({ width: 1080, height: 1080, durationInFrames: 270 });
    expect(findClip(doc, COMPOSITION_CLIP)?.clip.props).toMatchObject({
      layout: 'helix',
      layoutParams: { turns: 3 },
      camera: 'push-in',
      cameraParams: { endDistance: 4 },
      background: '#123456',
      loop: 9,
      media: [{ assetId: 'a1', kind: 'image' }, { assetId: 'v1', kind: 'video' }]
    });
  });

  it('a bento with a motion editor wired in opens with that motion inside its cell, at its head revision, for export', async () => {
    const bento = record('comp-node', 'composition', { layout: 'bento', layoutParams: { columns: 2, rows: 1 }, camera: { preset: 'static', params: {} }, background: { color: '#000000' }, duration: 6, aspect: '16:9', refId: null, cells: { 'mot-1': { timing: 'hold' } } });
    const motionDoc = (() => {
      const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Title', from: 0, durationInFrames: 40 }, 'hello');
      if (!added.ok) {
        throw new Error(added.error);
      }
      return { ...added.doc, durationInFrames: 40 };
    })();
    const d = migrating({
      findNode: vi.fn(async () => bento),
      listNodes: vi.fn(async () => [bento, record('img-1', 'image', { assetId: 'a1' }), record('mot-1', 'motion', { format: 'landscape', docHeadRevision: 5, posterAssetId: null, lastRenderAssetId: null })]),
      listConnections: vi.fn(async () => [
        { id: 'e1', canvasId: 'c1', sourceNodeId: 'img-1', targetNodeId: 'comp-node', sourceHandle: null, targetHandle: null, mode: 'fixed' },
        { id: 'e2', canvasId: 'c1', sourceNodeId: 'mot-1', targetNodeId: 'comp-node', sourceHandle: null, targetHandle: null, mode: 'fixed' }
      ]) as never,
      readHead: vi.fn(async (_db: Db, input: { nodeId: string }) => (input.nodeId === 'mot-1' ? { version: 5, doc: motionDoc, summary: null, actorKind: 'user' } : null))
    });

    await openCanvasComposition(db, d, { orgId: 'org', projectId: 'p1', canvasId: 'c1', nodeId: 'comp-node', userId: 'u1' });

    const doc = vi.mocked(d.saveMotionDoc).mock.calls[0][1].doc as MotionDoc;
    expect(findClip(doc, COMPOSITION_CLIP)?.clip.props.media).toEqual([
      { assetId: 'a1', kind: 'image' },
      { assetId: motionCompId('mot-1'), kind: 'comp', timing: 'hold' }
    ]);
    expect(doc.comps[motionCompId('mot-1')].tracks.flatMap((t) => t.clips.map((c) => c.id))).toEqual(['hello']);
  });

  it('leaves the canvas node untouched', async () => {
    const d = migrating();
    await openCanvasComposition(db, d, { orgId: 'org', projectId: 'p1', canvasId: 'c1', nodeId: 'comp-node', userId: 'u1' });

    expect(legacy.data).toMatchObject({ layout: 'helix', duration: 9 });
  });

  it('refuses a node that is not a composition on that canvas', async () => {
    const d = migrating({ findNode: vi.fn(async () => record('img-1', 'image', {})) });

    expect(await openCanvasComposition(db, d, { orgId: 'org', projectId: 'p1', canvasId: 'c1', nodeId: 'img-1', userId: 'u1' })).toEqual({ ok: false, error: 'node_not_found' });
  });
});
