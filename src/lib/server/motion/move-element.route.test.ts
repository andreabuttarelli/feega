import { describe, expect, it } from 'vitest';
import { actions } from '../../../routes/p/[projectId]/c/[canvasId]/+page.server';
import { fakeDb } from '$lib/server/db/fake-db';
import { listConnections, listNodes } from '$lib/server/repos/canvas';
import { canvasFrameInputs } from './move-element';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';

const SOURCE = '44444444-4444-4444-4444-444444444444';
const TARGET = '66666666-6666-6666-6666-666666666666';
const GEN = '77777777-7777-4777-8777-777777777777';
const ASSET = '88888888-8888-4888-8888-888888888888';

function withText(): MotionDoc {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'move me' } }, 'txt');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return added.doc;
}

const frameRow = (id: string) => ({ id, org_id: 'org', canvas_id: 'canvas', project_id: 'project', type: 'motion', display_name: 'Frame', x: 0, y: 0, z: 0, width: null, height: null, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null }, version: 1 });

const revisionRow = (nodeId: string, version: number, doc: MotionDoc) => ({ org_id: 'org', node_id: nodeId, version, doc, summary: null, actor_kind: 'user' });

function event(fields: Record<string, string>, rows: Record<string, unknown[]> = {}) {
  const fake = fakeDb(
    {
      orgs_members: [{ user_id: 'user', org_id: 'org', role: 'owner', orgs: { id: 'org', name: 'Org', slug: 'org' } }],
      canvases: [{ id: 'canvas', org_id: 'org', project_id: 'project', name: 'Canvas', viewport: null }],
      projects: [{ id: 'project', org_id: 'org', name: 'P', slug: 'p', brand_id: null, archived_at: null, updated_at: '', mode: 'standard' }],
      nodes: [frameRow(SOURCE), frameRow(TARGET)],
      nodes_connections: [],
      motion_revisions: [revisionRow(SOURCE, 1, withText()), revisionRow(TARGET, 1, newMotionDoc(MotionFormat.Vertical))],
      ...rows
    },
    { filter: true, newId: () => '99999999-9999-4999-8999-999999999999' }
  );
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    body.set(key, value);
  }
  return {
    ...fake,
    request: new Request('http://localhost/c/canvas', { method: 'POST', body }),
    params: { canvasId: 'canvas', projectId: 'project' },
    setHeaders: () => undefined,
    locals: { safeGetSession: async () => ({ session: {}, user: { id: 'user' } }), db: async () => fake.db }
  };
}

const written = (input: ReturnType<typeof event>, nodeId: string) =>
  input.calls.filter((c) => c.table === 'motion_revisions' && c.op === 'insert' && (c.payload as { node_id: string }).node_id === nodeId).map((c) => c.payload as { version: number; doc: MotionDoc });

const clipIds = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips).map((c) => c.id);

describe('moveElement action', () => {
  it('a text element dragged from frame A to frame B is saved in both revisions', async () => {
    const input = event({ source: SOURCE, clip: 'txt', drop: JSON.stringify({ on: 'frame', nodeId: TARGET, at: { x: 0.5, y: 0.25 } }) });

    const result = await actions.moveElement(input as never);

    expect(result).toMatchObject({ outcome: 'done', frameId: TARGET, clipId: 'txt' });
    expect(written(input, TARGET).map((r) => [r.version, clipIds(r.doc)])).toEqual([[2, ['txt']]]);
    expect(written(input, SOURCE).map((r) => [r.version, clipIds(r.doc)])).toEqual([[2, []]]);
  });

  it('dropped on the empty canvas it makes a new frame holding the element', async () => {
    const input = event({ source: SOURCE, clip: 'txt', drop: JSON.stringify({ on: 'canvas', x: 900, y: 40 }) });

    const result = await actions.moveElement(input as never);

    expect(result).toMatchObject({ outcome: 'done', created: true });
    expect(input.calls.some((c) => c.table === 'nodes' && c.op === 'insert' && (c.payload as { type: string }).type === 'motion')).toBe(true);
    const revisions = input.calls.filter((c) => c.table === 'motion_revisions' && c.op === 'insert').map((c) => c.payload as { version: number; doc: MotionDoc });
    expect(revisions.map((r) => [r.version, clipIds(r.doc)])).toEqual([
      [1, ['txt']],
      [2, []]
    ]);
  });

  it('an unreadable drop is a 400, nothing written', async () => {
    const input = event({ source: SOURCE, clip: 'txt', drop: 'nope' });

    expect(await actions.moveElement(input as never)).toMatchObject({ status: 400 });
    expect(input.calls.some((c) => c.op === 'insert')).toBe(false);
  });
});

describe('placeOutput action', () => {
  it('a generated image dropped into a frame becomes an image element; the generative node is not written', async () => {
    const input = event(
      { source: GEN, drop: JSON.stringify({ on: 'frame', nodeId: TARGET, at: { x: 0.5, y: 0.5 } }) },
      {
        nodes: [frameRow(TARGET), { ...frameRow(GEN), type: 'image', data: { prompt: 'a cat', refId: ASSET } }],
        assets: [{ id: ASSET, org_id: 'org', project_id: 'project', type: 'image', url: 'x.png', content: null, mime_type: 'image/png', bytes: 1, width: 512, height: 512, duration_s: null, source: 'generated', source_node_id: GEN, uncensored: false, created_at: '' }]
      }
    );

    const result = await actions.placeOutput(input as never);

    expect(result).toMatchObject({ outcome: 'done', frameId: TARGET });
    const doc = written(input, TARGET)[0].doc;
    expect(doc.tracks[0].clips[0]).toMatchObject({ component: 'Image', props: { assetId: ASSET } });
    expect(input.calls.some((c) => c.table === 'nodes' && c.op === 'update' && c.filters.some(([k, v]) => k === 'id' && v === GEN))).toBe(false);
  });
});

describe('upload action over a frame', () => {
  it('a pasted picture lands inside the frame and makes no node of its own', async () => {
    const input = event({ path: 'org/project/pasted.png', file_name: 'pasted.png', mime_type: 'image/png', bytes: '10', width: '400', height: '300', drop: JSON.stringify({ on: 'frame', nodeId: TARGET, at: { x: 0.25, y: 0.5 } }) });

    const result = await actions.upload(input as never);

    expect(result).toMatchObject({ outcome: 'done', frameId: TARGET });
    expect(written(input, TARGET)[0].doc.tracks[0].clips[0]).toMatchObject({ component: 'Image', props: { assetId: '99999999-9999-4999-8999-999999999999', x: 0.25, y: 0.5 } });
    expect(input.calls.some((c) => c.table === 'nodes' && c.op === 'insert')).toBe(false);
  });
});

describe('a generated output placed on the empty canvas', () => {
  const asset = (type: string, width: number, height: number) => ({ id: ASSET, org_id: 'org', project_id: 'project', type, url: 'x', content: type === 'text' ? 'Hello' : null, mime_type: 'image/png', bytes: 1, width, height, duration_s: type === 'video' ? 3 : null, source: 'generated', source_node_id: GEN, uncensored: false, created_at: '' });
  const placed = (input: ReturnType<typeof event>) => ({
    node: input.calls.find((c) => c.table === 'nodes' && c.op === 'insert')?.payload as { width: number; height: number; data: Record<string, unknown> },
    doc: (input.calls.find((c) => c.table === 'motion_revisions' && c.op === 'insert')?.payload as { doc: MotionDoc }).doc
  });

  it.each([
    ['image', 'Image', 800, 400],
    ['video', 'Video', 1920, 1080],
    ['text', 'Text', 0, 0]
  ])('a %s becomes a free %s element, not a frame', async (type, component, width, height) => {
    const input = event(
      { source: GEN, drop: JSON.stringify({ on: 'canvas', x: 500, y: 300 }) },
      { nodes: [{ ...frameRow(GEN), type, data: { prompt: 'p', refId: ASSET } }], assets: [asset(type, width, height)] }
    );

    expect(await actions.placeOutput(input as never)).toMatchObject({ outcome: 'done', created: true });
    const { node, doc } = placed(input);
    expect(node.data.kind).toBe('element');
    expect(doc.background).toBe('transparent');
    expect(doc.tracks.flatMap((t) => t.clips).map((c) => c.component)).toEqual([component]);
    if (width) {
      expect(node.width / node.height).toBeCloseTo(width / height, 1);
    }
  });

  it('a placed text shows settled: the still sits where its entrance has finished, not on its first frame', async () => {
    const input = event(
      { source: GEN, drop: JSON.stringify({ on: 'canvas', x: 500, y: 300 }) },
      { nodes: [{ ...frameRow(GEN), type: 'text', data: { prompt: 'p', refId: ASSET } }], assets: [asset('text', 0, 0)] }
    );

    await actions.placeOutput(input as never);
    const { doc } = placed(input);
    const clip = doc.tracks.flatMap((t) => t.clips)[0];
    expect(doc.still?.frame).toBe(clip.from + clip.durationInFrames - 1);
    expect(clip.props.color).toBe('#111111');
  });

  it('a tiny picture still gets a sharp element: the doc is sized by the canvas box, not by the source pixels', async () => {
    const input = event(
      { source: GEN, drop: JSON.stringify({ on: 'canvas', x: 500, y: 300 }) },
      { nodes: [{ ...frameRow(GEN), type: 'image', data: { prompt: 'p', refId: ASSET } }], assets: [asset('image', 1, 1)] }
    );

    await actions.placeOutput(input as never);
    const { node, doc } = placed(input);
    expect(doc.width).toBeGreaterThanOrEqual(node.width);
    expect(doc.tracks.flatMap((t) => t.clips)[0].props).toMatchObject({ width: 1, height: 1 });
  });
});

describe('undo of a move', () => {
  it('restores the frame doc that was there before, as a new revision', async () => {
    const before = withText();
    const input = event(
      { items: JSON.stringify([{ kind: 'doc.revision', nodeId: SOURCE, before: 1, after: 2 }]) },
      { motion_revisions: [revisionRow(SOURCE, 2, newMotionDoc(MotionFormat.Landscape)), revisionRow(SOURCE, 1, before)] }
    );

    const result = await actions.undo(input as never);

    expect(result).toMatchObject({ outcome: 'undone', redo: { items: [{ kind: 'doc.revision', nodeId: SOURCE, before: 2, after: 3 }] } });
    expect(written(input, SOURCE).map((r) => [r.version, clipIds(r.doc)])).toEqual([[3, ['txt']]]);
  });
});

describe('connect action', () => {
  it('a line into a frame is refused and the frame is left alone', async () => {
    const input = event(
      { source_node_id: GEN, target_node_id: TARGET, kind: 'derives_from' },
      { nodes: [frameRow(TARGET), { ...frameRow(GEN), type: 'image', data: { prompt: 'a cat', refId: ASSET } }] }
    );

    const result = await actions.connect(input as never);

    expect(result).toMatchObject({ status: 400 });
    expect(written(input, TARGET)).toEqual([]);
  });
});

describe('opening a canvas with an old line into a frame', () => {
  it('places the source output in the frame, then removes the line', async () => {
    const input = event(
      {},
      {
        nodes: [frameRow(TARGET), { ...frameRow(GEN), type: 'image', data: { prompt: 'a cat', refId: ASSET } }],
        nodes_connections: [{ id: 'line', org_id: 'org', canvas_id: 'canvas', source_node_id: GEN, target_node_id: TARGET, source_handle: null, target_handle: null, mode: 'fixed', deleted_at: null }],
        assets: [{ id: ASSET, org_id: 'org', project_id: 'project', type: 'image', url: 'x.png', content: null, mime_type: 'image/png', bytes: 1, width: 512, height: 512, duration_s: null, source: 'generated', source_node_id: GEN, uncensored: false, created_at: '' }]
      }
    );

    const scope = { orgId: 'org', canvasId: 'canvas' };
    const kept = await canvasFrameInputs(input.db, { orgId: 'org', projectId: 'project', actor: { kind: 'user', id: 'user' } }, await listNodes(input.db, scope), await listConnections(input.db, scope));

    expect(kept).toEqual([]);
    expect(written(input, TARGET)[0].doc.tracks[0].clips[0]).toMatchObject({ component: 'Image', props: { assetId: ASSET } });
    expect(input.calls.some((c) => c.table === 'nodes_connections' && c.op === 'update')).toBe(true);
  });
});

describe('elements in and out of frames', () => {
  const inserted = (input: ReturnType<typeof event>) => input.calls.filter((c) => c.table === 'nodes' && c.op === 'insert').map((c) => c.payload as { x: number; y: number; width: number; height: number; data: Record<string, unknown> });
  const wideFrame = (id: string) => ({ ...frameRow(id), width: 400 });

  it('dragged out onto the canvas it is a free element of the size it had on screen, centred where it was dropped', async () => {
    const input = event(
      { source: SOURCE, clip: 'txt', drop: JSON.stringify({ on: 'canvas', x: 900, y: 40 }), box: JSON.stringify({ left: 0.25, top: 0.25, width: 0.5, height: 0.2 }) },
      { nodes: [wideFrame(SOURCE), frameRow(TARGET)] }
    );

    expect(await actions.moveElement(input as never)).toMatchObject({ outcome: 'done', created: true });
    expect(inserted(input)).toMatchObject([{ x: 800, y: 17.5, width: 200, height: 45, data: { kind: 'element' } }]);
    const made = input.calls.find((c) => c.table === 'motion_revisions' && c.op === 'insert')?.payload as { doc: MotionDoc };
    expect(made.doc.background).toBe('transparent');
  });

  it('a free element dropped on a frame goes inside it, and the empty element leaves the canvas', async () => {
    const element = { ...frameRow(SOURCE), width: 200, height: 45, data: { ...frameRow(SOURCE).data, kind: 'element' } };
    const input = event({ source: SOURCE, clip: 'txt', drop: JSON.stringify({ on: 'frame', nodeId: TARGET, at: { x: 0.5, y: 0.5 } }) }, { nodes: [element, frameRow(TARGET)] });

    const result = await actions.moveElement(input as never);

    expect(result).toMatchObject({ outcome: 'done', frameId: TARGET });
    expect(written(input, TARGET).map((r) => clipIds(r.doc))).toEqual([['txt']]);
    expect(written(input, SOURCE)).toEqual([]);
    expect(input.calls.some((c) => c.table === 'nodes' && c.op === 'update' && (c.payload as { deleted_at?: string }).deleted_at && c.filters.some(([k, v]) => k === 'id' && v === SOURCE))).toBe(true);
    expect((result as { undo: { kind: string }[] }).undo.map((u) => u.kind)).toEqual(['doc.revision', 'node.delete']);
  });

  it('moveFree drops the whole free element on a frame without naming its clip', async () => {
    const element = { ...frameRow(SOURCE), width: 200, height: 45, data: { ...frameRow(SOURCE).data, kind: 'element' } };
    const input = event({ source: SOURCE, drop: JSON.stringify({ on: 'frame', nodeId: TARGET, at: { x: 0.3, y: 0.6 } }) }, { nodes: [element, frameRow(TARGET)] });

    expect(await actions.moveFree(input as never)).toMatchObject({ outcome: 'done', frameId: TARGET });
    expect(written(input, TARGET).map((r) => clipIds(r.doc))).toEqual([['txt']]);
  });

  it('copyFree pastes a free element into a frame and keeps the free element', async () => {
    const element = { ...frameRow(SOURCE), width: 200, height: 45, data: { ...frameRow(SOURCE).data, kind: 'element' } };
    const input = event({ source: SOURCE, drop: JSON.stringify({ on: 'frame', nodeId: TARGET, at: { x: 0.3, y: 0.6 } }) }, { nodes: [element, frameRow(TARGET)] });

    const result = await actions.copyFree(input as never);

    expect(result).toMatchObject({ outcome: 'done', frameId: TARGET });
    expect(written(input, TARGET)).toHaveLength(1);
    expect(input.calls.some((c) => c.table === 'nodes' && c.op === 'update' && (c.payload as { deleted_at?: string }).deleted_at)).toBe(false);
    expect((result as { undo: { kind: string }[] }).undo.map((u) => u.kind)).toEqual(['doc.revision']);
  });
});

describe('drawElement action', () => {
  const inserted = (input: ReturnType<typeof event>) => input.calls.filter((c) => c.table === 'nodes' && c.op === 'insert').map((c) => c.payload as { type: string; x: number; y: number; width: number; height: number; data: Record<string, unknown> });

  it('a rectangle drawn on the empty canvas is a free element: a chromeless frame on the drawn box', async () => {
    const input = event({ drawn: JSON.stringify({ tool: 'rectangle', box: { left: 120, top: 40, width: 300, height: 100 } }) });

    const result = await actions.drawElement(input as never);

    expect(result).toMatchObject({ outcome: 'done', created: true, node: { type: 'motion' } });
    expect(inserted(input)).toMatchObject([{ type: 'motion', x: 120, y: 40, width: 300, height: 100, data: { kind: 'element' } }]);
    const revisions = input.calls.filter((c) => c.table === 'motion_revisions' && c.op === 'insert').map((c) => c.payload as { version: number; doc: MotionDoc });
    expect(revisions.map((r) => [r.version, r.doc.background, r.doc.tracks.flatMap((t) => t.clips).map((c) => c.component)])).toEqual([[1, 'transparent', ['Shape']]]);
  });

  it('keeps the id the canvas already shows, so the drawn shape never leaves the screen', async () => {
    const id = '7b0c2f0e-8a51-4d0e-9a8e-2f2f6c1b9a10';
    const input = event({ drawn: JSON.stringify({ tool: 'ellipse', box: { left: 0, top: 0, width: 50, height: 50 } }), node_id: id });

    expect(await actions.drawElement(input as never)).toMatchObject({ outcome: 'done' });
    expect(inserted(input)).toMatchObject([{ id }]);
  });

  it('a text drawn on a dark canvas is written in light ink', async () => {
    const input = event({ drawn: JSON.stringify({ tool: 'text', box: { left: 0, top: 0, width: 300, height: 100 }, theme: 'dark' }) });

    await actions.drawElement(input as never);

    const revisions = input.calls.filter((c) => c.table === 'motion_revisions' && c.op === 'insert').map((c) => c.payload as { doc: MotionDoc });
    expect(revisions.flatMap((r) => r.doc.tracks.flatMap((t) => t.clips).map((c) => c.props.color))).toEqual(['#f5f5f5']);
  });

  it('a pen path is placed at the box of its points', async () => {
    const input = event({ drawn: JSON.stringify({ tool: 'pen', path: 'M 10 20 L 110 20 L 110 70' }) });

    await actions.drawElement(input as never);

    expect(inserted(input)).toMatchObject([{ x: 10, y: 20, width: 100, height: 50 }]);
  });

  it('a pasted svg path keeps its colour, and pasted text keeps its words', async () => {
    const input = event({ drawn: JSON.stringify({ tool: 'pen', path: 'M 0 0 L 10 0 L 10 10 Z', fill: '#ff0000', stroke: null }) });
    const text = event({ drawn: JSON.stringify({ tool: 'text', box: { left: 0, top: 0, width: 300, height: 100 }, text: 'pasted words' }) });

    await actions.drawElement(input as never);
    await actions.drawElement(text as never);

    const props = (e: ReturnType<typeof event>) => e.calls.filter((c) => c.table === 'motion_revisions' && c.op === 'insert').flatMap((c) => (c.payload as { doc: MotionDoc }).doc.tracks.flatMap((t) => t.clips).map((c) => c.props));
    expect(props(input)).toMatchObject([{ fill: '#ff0000' }]);
    expect(props(text)).toMatchObject([{ text: 'pasted words' }]);
  });

  it('an unreadable drawing is a 400, nothing written', async () => {
    const input = event({ drawn: JSON.stringify({ tool: 'select', box: { left: 0, top: 0, width: 1, height: 1 } }) });

    expect(await actions.drawElement(input as never)).toMatchObject({ status: 400 });
    expect(input.calls.some((c) => c.op === 'insert')).toBe(false);
  });
});

describe('drawFrame action', () => {
  const inserted = (input: ReturnType<typeof event>) => input.calls.filter((c) => c.table === 'nodes' && c.op === 'insert').map((c) => c.payload as { id?: string; type: string; x: number; y: number; width: number; height: number; data: Record<string, unknown> });

  it('a frame dragged on the canvas is one frame of the dragged size, under the id the canvas shows', async () => {
    const id = '7b0c2f0e-8a51-4d0e-9a8e-2f2f6c1b9a11';
    const input = event({ box: JSON.stringify({ left: 100, top: 50, width: 400, height: 300 }), node_id: id });

    expect(await actions.drawFrame(input as never)).toMatchObject({ outcome: 'done', created: true });
    const rows = inserted(input);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id, type: 'motion', x: 100, y: 50, width: 400 });
    expect(rows[0].data.kind ?? 'frame').toBe('frame');
    const revisions = input.calls.filter((c) => c.table === 'motion_revisions' && c.op === 'insert').map((c) => c.payload as { doc: MotionDoc });
    expect(revisions.map((r) => r.doc.width / r.doc.height)).toEqual([400 / 300]);
  });

  it('an unreadable box is a 400, nothing written', async () => {
    const input = event({ box: JSON.stringify({ left: 0, top: 0, width: -1, height: 1 }) });

    expect(await actions.drawFrame(input as never)).toMatchObject({ status: 400 });
    expect(input.calls.some((c) => c.op === 'insert')).toBe(false);
  });
});
