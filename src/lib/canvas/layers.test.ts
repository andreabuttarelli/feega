import { describe, expect, it } from 'vitest';
import { LayerAction, LayerKind, Pick, dropLayer, layerEdit, layerKey, layerRows, pickLayers } from './layers';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip, addTrack } from '$lib/motion/timeline';
import { TrackKind } from '$lib/motion/components';

const NODES = [
  { id: 'n1', type: 'text', name: 'Hook' },
  { id: 'm1', type: 'motion', name: 'Teaser' },
  { id: 'm2', type: 'motion', name: null }
];

function video(): MotionDoc {
  let doc = newMotionDoc(MotionFormat.Landscape);
  const second = addTrack(doc, TrackKind.Visual, 'v2', 'Overlay');
  doc = second.ok ? second.doc : doc;
  const title = addClip(doc, { component: 'Title', from: 0 }, 't1');
  doc = title.ok ? title.doc : doc;
  return doc;
}

const ok = (r: ReturnType<typeof layerEdit>) => {
  if (!r.ok) {
    throw new Error(r.error);
  }
  return r.doc;
};

describe('layer rows', () => {
  it('list every canvas node at the top level, named, and only the open video unfolds into tracks and clips', () => {
    const doc = video();
    const rows = layerRows(NODES, { nodeId: 'm1', doc });

    expect(rows.filter((r) => r.depth === 0).map((r) => [r.id, r.kind, r.label])).toEqual([
      ['n1', LayerKind.Node, 'Hook'],
      ['m1', LayerKind.Node, 'Teaser'],
      ['m2', LayerKind.Node, 'motion']
    ]);
    const inside = rows.filter((r) => r.nodeId === 'm1' && r.depth > 0);
    expect(inside.map((r) => r.kind)).toEqual([...doc.tracks.flatMap((t) => [LayerKind.Track, ...t.clips.map(() => LayerKind.Clip)])]);
    expect(rows.find((r) => r.id === 't1')).toMatchObject({ kind: LayerKind.Clip, depth: 2, label: 'Title' });
    expect(rows.some((r) => r.nodeId === 'm2' && r.depth > 0)).toBe(false);
  });

  it('shows a template instance as one locked group, not its insides', () => {
    const doc = video();
    const withTemplate: MotionDoc = {
      ...doc,
      comps: { c1: { id: 'c1', name: 'Card', width: doc.width, height: doc.height, durationInFrames: 30, tracks: [], template: { id: 'tpl', keys: {} } } as never },
      tracks: doc.tracks.map((t, i) => (i === 0 ? { ...t, clips: [...t.clips, { ...t.clips[0], id: 'p1', component: 'Precomp', props: { comp: 'c1' } }] } : t))
    };

    expect(layerRows(NODES, { nodeId: 'm1', doc: withTemplate }).find((r) => r.id === 'p1')).toMatchObject({ kind: LayerKind.Group, locked: true });
  });
});

describe('poster parts in layers', () => {
  it('lists the tagged parts of a clip under it, one level deeper, as part rows', () => {
    const doc = video();
    const rows = layerRows(NODES, { nodeId: 'm1', doc, parts: { t1: ['lines:0', 'footer1'] } });
    const clip = rows.findIndex((r) => r.id === 't1');

    expect(rows.slice(clip + 1, clip + 3).map((r) => [r.id, r.kind, r.depth, r.label])).toEqual([
      ['t1#lines:0', LayerKind.Part, 3, 'lines 1'],
      ['t1#footer1', LayerKind.Part, 3, 'footer1']
    ]);
  });
});

describe('layer edits go through the doc operations the editor and the agent already use', () => {
  it('moves a track up the stack and back down', () => {
    const doc = video();
    const [top, second] = doc.tracks.map((t) => t.id);

    const up = ok(layerEdit(doc, second, LayerAction.Up));
    expect(up.tracks.map((t) => t.id).slice(0, 2)).toEqual([second, top]);
    expect(ok(layerEdit(up, second, LayerAction.Down)).tracks.map((t) => t.id).slice(0, 2)).toEqual([top, second]);
  });

  it('moves a clip to the neighbouring track of its kind, keeping its time', () => {
    const doc = video();
    const owner = doc.tracks.find((t) => t.clips.some((c) => c.id === 't1'))!;
    const index = doc.tracks.indexOf(owner);
    const action = index === 0 ? LayerAction.Down : LayerAction.Up;

    const moved = ok(layerEdit(doc, 't1', action));
    const now = moved.tracks.find((t) => t.clips.some((c) => c.id === 't1'))!;
    expect(now.id).not.toBe(owner.id);
    expect(now.clips.find((c) => c.id === 't1')!.from).toBe(0);
  });

  it('hides and locks tracks and clips, and renames tracks', () => {
    const doc = video();
    const track = doc.tracks[0].id;

    expect(ok(layerEdit(doc, track, LayerAction.Hide)).tracks[0].hidden).toBe(true);
    expect(ok(layerEdit(doc, 't1', LayerAction.Lock)).tracks.flatMap((t) => t.clips).find((c) => c.id === 't1')!.locked).toBe(true);
    expect(ok(layerEdit(doc, track, LayerAction.Rename, 'Front')).tracks[0].name).toBe('Front');
  });

  it('refuses what the model has no place for', () => {
    const doc = video();

    expect(layerEdit(doc, 't1', LayerAction.Rename, 'x').ok).toBe(false);
    expect(layerEdit(doc, doc.tracks[0].id, LayerAction.Up).ok).toBe(false);
    expect(layerEdit(doc, 'nope', LayerAction.Hide).ok).toBe(false);
  });
});

describe('dragging a layer', () => {
  it('drops a track onto another track: it takes that place in the stack', () => {
    const doc = video();
    const ids = doc.tracks.map((t) => t.id);
    const last = ids[ids.length - 1];

    expect(ok(dropLayer(doc, last, ids[0])).tracks[0].id).toBe(last);
  });

  it('drops a clip onto a track of its kind: it moves there at the same time', () => {
    const doc = video();
    const other = doc.tracks.find((t) => t.kind === 'visual' && !t.clips.some((c) => c.id === 't1'))!;

    const moved = ok(dropLayer(doc, 't1', other.id));
    expect(moved.tracks.find((t) => t.id === other.id)!.clips.map((c) => c.id)).toContain('t1');
  });

  it('refuses a clip dropped on a track of another kind, or on a clip', () => {
    const doc = video();
    const audio = doc.tracks.find((t) => t.kind === 'audio')!;

    expect(dropLayer(doc, 't1', audio.id).ok).toBe(false);
    expect(dropLayer(doc, doc.tracks[0].id, 't1').ok).toBe(false);
  });
});

describe('layer keys and selection', () => {
  it('⌘] brings forward, ⌘[ sends backward, nothing else is a layer key', () => {
    expect(layerKey({ key: ']', mod: true })).toBe(LayerAction.Up);
    expect(layerKey({ key: '[', mod: true })).toBe(LayerAction.Down);
    expect(layerKey({ key: ']', mod: false })).toBeNull();
    expect(layerKey({ key: 'a', mod: true })).toBeNull();
  });

  it('click picks one, ⌘ toggles, shift extends the range in list order', () => {
    const order = ['a', 'b', 'c', 'd'];

    expect(pickLayers(['a'], 'c', Pick.One, order)).toEqual(['c']);
    expect(pickLayers(['a'], 'c', Pick.Toggle, order)).toEqual(['a', 'c']);
    expect(pickLayers(['a', 'c'], 'a', Pick.Toggle, order)).toEqual(['c']);
    expect(pickLayers(['b'], 'd', Pick.Range, order)).toEqual(['b', 'c', 'd']);
  });
});
