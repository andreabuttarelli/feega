import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { setStill } from '$lib/motion/still';
import { OutputKind, type Output } from '$lib/motion/move-element';
import { RevisionOutcome, type RevisionWrite } from '$lib/server/repos/motion-revisions';
import { DropOn, MoveOutcome, linkFrame, moveElement, placeOutput, refreshLinks, type FrameStore, type StoredFrame } from './move-element';

const IMAGE_ID = '11111111-2222-4333-8444-555555555555';
const OTHER_ID = '22222222-2222-4333-8444-555555555555';
const VIDEO_ID = '33333333-2222-4333-8444-555555555555';

function must(result: { ok: true; doc: MotionDoc } | { ok: false; error: string }): MotionDoc {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.doc;
}

type Memory = { store: FrameStore; frames: Map<string, StoredFrame[]>; outputs: Map<string, Output>; edges: [string, string][]; removed: string[] };

function memory(): Memory {
  const frames = new Map<string, StoredFrame[]>();
  const outputs = new Map<string, Output>();
  const edges: [string, string][] = [];
  const removed: string[] = [];
  let made = 0;
  const head = (id: string) => frames.get(id)?.at(-1) ?? null;

  const store: FrameStore = {
    read: async (nodeId) => head(nodeId),
    write: async (nodeId, expected, doc): Promise<RevisionWrite> => {
      const now = head(nodeId);
      if (!now || now.version !== expected) {
        return { outcome: RevisionOutcome.Conflict };
      }
      frames.get(nodeId)!.push({ ...now, version: expected + 1, doc });
      return { outcome: RevisionOutcome.Written, head: { version: expected + 1, doc, summary: null, actorKind: 'user' } };
    },
    create: async (place, doc) => {
      const nodeId = `frame-${++made}`;
      frames.set(nodeId, [{ nodeId, projectId: place.projectId, canvasId: place.canvasId, version: 1, doc }]);
      return nodeId;
    },
    remove: async (nodeId) => {
      removed.push(nodeId);
    },
    output: async (nodeId) => {
      const output = outputs.get(nodeId);
      return output ? { output, projectId: 'p1', canvasId: 'c1' } : null;
    },
    fedFrames: async (nodeId) => edges.filter(([from]) => from === nodeId).map(([, to]) => to)
  };
  return { store, frames, outputs, edges, removed };
}

function seed(m: Memory, nodeId: string, doc: MotionDoc) {
  m.frames.set(nodeId, [{ nodeId, projectId: 'p1', canvasId: 'c1', version: 1, doc }]);
}

const clipsOf = (doc: MotionDoc) => doc.tracks.flatMap((t) => t.clips);
const headOf = (m: Memory, id: string) => m.frames.get(id)!.at(-1)!;

function withText(): MotionDoc {
  return must(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Text', from: 0, durationInFrames: 60, props: { text: 'move me', x: 0.3, y: 0.3 } }, 'txt'));
}

describe('moving an element between frames', () => {
  it('leaves the source, lands in the target at the drop point, both saved', async () => {
    const m = memory();
    seed(m, 'a', withText());
    seed(m, 'b', newMotionDoc(MotionFormat.Vertical));

    const moved = await moveElement(m.store, { sourceNodeId: 'a', clipId: 'txt', drop: { on: DropOn.Frame, nodeId: 'b', at: { x: 0.6, y: 0.7 } } });

    expect(moved).toMatchObject({ outcome: MoveOutcome.Done, frameId: 'b', clipId: 'txt', created: false });
    expect(findClip(headOf(m, 'a').doc, 'txt')).toBeNull();
    expect(findClip(headOf(m, 'b').doc, 'txt')?.clip.props).toMatchObject({ text: 'move me', x: 0.6, y: 0.7 });
    expect([headOf(m, 'a').version, headOf(m, 'b').version]).toEqual([2, 2]);
  });

  it('answers one undo step that names both revisions', async () => {
    const m = memory();
    seed(m, 'a', withText());
    seed(m, 'b', newMotionDoc(MotionFormat.Vertical));

    const moved = await moveElement(m.store, { sourceNodeId: 'a', clipId: 'txt', drop: { on: DropOn.Frame, nodeId: 'b', at: { x: 0.5, y: 0.5 } } });

    expect(moved.outcome === MoveOutcome.Done && moved.undo).toEqual([
      { kind: 'doc.revision', nodeId: 'b', before: 1, after: 2 },
      { kind: 'doc.revision', nodeId: 'a', before: 1, after: 2 }
    ]);
  });

  it('a stale version is refused before anything is written', async () => {
    const m = memory();
    seed(m, 'a', withText());
    seed(m, 'b', newMotionDoc(MotionFormat.Vertical));

    const moved = await moveElement(m.store, { sourceNodeId: 'a', clipId: 'txt', drop: { on: DropOn.Frame, nodeId: 'b', at: { x: 0.5, y: 0.5 } }, versions: { a: 7 } });

    expect(moved.outcome).toBe(MoveOutcome.Conflict);
    expect([headOf(m, 'a').version, headOf(m, 'b').version]).toEqual([1, 1]);
  });

  it('when the source changes underneath, the target is put back', async () => {
    const m = memory();
    seed(m, 'a', withText());
    seed(m, 'b', newMotionDoc(MotionFormat.Vertical));
    const write = m.store.write;
    m.store.write = async (nodeId, expected, doc, summary) => (nodeId === 'a' ? { outcome: RevisionOutcome.Conflict } : write(nodeId, expected, doc, summary));

    const moved = await moveElement(m.store, { sourceNodeId: 'a', clipId: 'txt', drop: { on: DropOn.Frame, nodeId: 'b', at: { x: 0.5, y: 0.5 } } });

    expect(moved.outcome).toBe(MoveOutcome.Conflict);
    expect(clipsOf(headOf(m, 'b').doc)).toEqual([]);
  });

  it('dropping in the same frame is not a move between frames', async () => {
    const m = memory();
    seed(m, 'a', withText());

    expect((await moveElement(m.store, { sourceNodeId: 'a', clipId: 'txt', drop: { on: DropOn.Frame, nodeId: 'a', at: { x: 0.5, y: 0.5 } } })).outcome).toBe(MoveOutcome.SameFrame);
  });

  it('an unknown element is refused', async () => {
    const m = memory();
    seed(m, 'a', withText());
    seed(m, 'b', newMotionDoc(MotionFormat.Vertical));

    expect((await moveElement(m.store, { sourceNodeId: 'a', clipId: 'nope', drop: { on: DropOn.Frame, nodeId: 'b', at: { x: 0.5, y: 0.5 } } })).outcome).toBe(MoveOutcome.NoElement);
  });
});

describe('dropping an element on the empty canvas', () => {
  it('makes a new frame of the same kind holding only that element', async () => {
    const m = memory();
    seed(m, 'a', must(setStill(withText(), 0.5)));

    const moved = await moveElement(m.store, { sourceNodeId: 'a', clipId: 'txt', drop: { on: DropOn.Canvas, x: 400, y: 120 }, box: { left: 0.1, top: 0.1, width: 0.4, height: 0.2 } });

    expect(moved).toMatchObject({ outcome: MoveOutcome.Done, frameId: 'frame-1', created: true });
    const made = headOf(m, 'frame-1').doc;
    expect(clipsOf(made).map((c) => c.id)).toEqual(['txt']);
    expect(made.still).toBeDefined();
    expect({ width: made.width, height: made.height }).toEqual({ width: 768, height: 216 });
    expect(findClip(headOf(m, 'a').doc, 'txt')).toBeNull();
    expect(moved.outcome === MoveOutcome.Done && moved.undo.map((u) => u.kind)).toEqual(['node.create', 'doc.revision']);
  });

  it('the new frame is taken away again when the source cannot be written', async () => {
    const m = memory();
    seed(m, 'a', withText());
    m.store.write = async () => ({ outcome: RevisionOutcome.Conflict });

    const moved = await moveElement(m.store, { sourceNodeId: 'a', clipId: 'txt', drop: { on: DropOn.Canvas, x: 0, y: 0 } });

    expect(moved.outcome).toBe(MoveOutcome.Conflict);
    expect(m.removed).toEqual(['frame-1']);
  });
});

describe('a generated output dropped into a frame', () => {
  it('a picture becomes an image element; the generative node is not touched', async () => {
    const m = memory();
    seed(m, 'b', newMotionDoc(MotionFormat.Square));
    m.outputs.set('gen', { kind: OutputKind.Image, assetId: IMAGE_ID, name: 'gen', width: 512, height: 512 });

    const placed = await placeOutput(m.store, { sourceNodeId: 'gen', drop: { on: DropOn.Frame, nodeId: 'b', at: { x: 0.25, y: 0.75 } } });

    expect(placed.outcome).toBe(MoveOutcome.Done);
    const clip = clipsOf(headOf(m, 'b').doc)[0];
    expect(clip).toMatchObject({ component: 'Image', props: { assetId: IMAGE_ID, x: 0.25, y: 0.75 } });
    expect(headOf(m, 'b').doc.assets.map((a) => a.id)).toEqual([IMAGE_ID]);
    expect(m.frames.has('gen')).toBe(false);
    expect(placed.outcome === MoveOutcome.Done && placed.undo).toEqual([{ kind: 'doc.revision', nodeId: 'b', before: 1, after: 2 }]);
  });

  it('a video lands at the playhead with its own duration', async () => {
    const m = memory();
    seed(m, 'b', { ...newMotionDoc(MotionFormat.Landscape), durationInFrames: 60 });
    m.outputs.set('gen', { kind: OutputKind.Video, assetId: VIDEO_ID, name: 'clip', seconds: 5 });

    await placeOutput(m.store, { sourceNodeId: 'gen', drop: { on: DropOn.Frame, nodeId: 'b', at: { x: 0.5, y: 0.5 }, frame: 30 } });

    expect(clipsOf(headOf(m, 'b').doc)[0]).toMatchObject({ component: 'Video', from: 30, durationInFrames: 150 });
  });

  it('on the empty canvas it makes a frame: a still for a picture, a video for a video', async () => {
    const m = memory();
    m.outputs.set('img', { kind: OutputKind.Image, assetId: IMAGE_ID, name: 'gen', width: 800, height: 600 });
    m.outputs.set('vid', { kind: OutputKind.Video, assetId: VIDEO_ID, name: 'clip', seconds: 2, width: 1280, height: 720 });

    const still = await placeOutput(m.store, { sourceNodeId: 'img', drop: { on: DropOn.Canvas, x: 0, y: 0 } });
    const video = await placeOutput(m.store, { sourceNodeId: 'vid', drop: { on: DropOn.Canvas, x: 0, y: 0 } });

    expect(still.outcome === MoveOutcome.Done && headOf(m, still.frameId).doc.still).toBeDefined();
    expect(video.outcome === MoveOutcome.Done && headOf(m, video.frameId).doc.still).toBeUndefined();
    expect(video.outcome === MoveOutcome.Done && headOf(m, video.frameId).doc).toMatchObject({ width: 1280, height: 720 });
  });

  it('a node with nothing generated yet has nothing to drop', async () => {
    const m = memory();
    seed(m, 'b', newMotionDoc(MotionFormat.Square));

    expect((await placeOutput(m.store, { sourceNodeId: 'gen', drop: { on: DropOn.Frame, nodeId: 'b', at: { x: 0.5, y: 0.5 } } })).outcome).toBe(MoveOutcome.NoOutput);
  });
});

describe('a generative node connected to a frame', () => {
  it('connecting places its output once; a new output updates the same element', async () => {
    const m = memory();
    seed(m, 'b', newMotionDoc(MotionFormat.Square));
    m.outputs.set('gen', { kind: OutputKind.Image, assetId: IMAGE_ID, name: 'gen' });
    m.edges.push(['gen', 'b']);

    await linkFrame(m.store, { sourceNodeId: 'gen', frameNodeId: 'b' });
    m.outputs.set('gen', { kind: OutputKind.Image, assetId: OTHER_ID, name: 'gen' });
    await refreshLinks(m.store, 'gen');

    const clips = clipsOf(headOf(m, 'b').doc);
    expect(clips).toHaveLength(1);
    expect(clips[0].props.assetId).toBe(OTHER_ID);
    expect(headOf(m, 'b').doc.links).toEqual({ gen: clips[0].id });
  });

  it('nothing generated yet: the frame is left alone', async () => {
    const m = memory();
    seed(m, 'b', newMotionDoc(MotionFormat.Square));

    await linkFrame(m.store, { sourceNodeId: 'gen', frameNodeId: 'b' });

    expect(headOf(m, 'b').version).toBe(1);
  });

  it('the same output again writes nothing', async () => {
    const m = memory();
    seed(m, 'b', newMotionDoc(MotionFormat.Square));
    m.outputs.set('gen', { kind: OutputKind.Text, text: 'hi', name: 'copy' });

    await linkFrame(m.store, { sourceNodeId: 'gen', frameNodeId: 'b' });
    await linkFrame(m.store, { sourceNodeId: 'gen', frameNodeId: 'b' });

    expect(headOf(m, 'b').version).toBe(2);
  });
});
