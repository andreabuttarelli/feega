import { describe, expect, it } from 'vitest';
import { LayerAction, LayerKind, Pick, dropLayer, frameHover, frameRows, rowPicked, rowsInside, tileHovered, layerEdit, layerKey, layerRows, pickFor, pickLayers, selectedLayers } from './layers';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip, addTrack } from '$lib/motion/timeline';
import { TrackKind } from '$lib/motion/components';
import { TYPE_GRID_CLIP, TYPE_GRID_POSTER_TEMPLATE } from '$lib/motion/template/type-grid-poster/template';

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
      ['m2', LayerKind.Node, 'Frame']
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

describe('a row key is unique across the whole tree', () => {
  it('two clips playing the same composition list its insides twice under distinct keys', () => {
    const doc = video();
    const inner = { id: 'in', kind: TrackKind.Visual, name: 'Inner', clips: [{ ...doc.tracks[0].clips[0], id: 'deep' }] };
    const shared: MotionDoc = {
      ...doc,
      comps: { c1: { id: 'c1', name: 'Scene', width: doc.width, height: doc.height, durationInFrames: 30, tracks: [inner] } as never },
      tracks: doc.tracks.map((t, i) => (i === 0 ? { ...t, clips: [{ ...t.clips[0], id: 'p1', component: 'Precomp', props: { comp: 'c1' } }, { ...t.clips[0], id: 'p2', component: 'Precomp', props: { comp: 'c1' } }] } : t))
    };
    const outline = frameRows(shared, 'm2');
    const rows = layerRows(NODES, { nodeId: 'm1', doc: shared }, { m2: outline });

    expect(rows.filter((r) => r.id === 'deep')).toHaveLength(4);
    expect(new Set(rows.map((r) => `${r.nodeId}/${r.key}`)).size).toBe(rows.length);
  });
});

describe('every frame lists its children, open or not', () => {
  it('a closed frame unfolds from its stored outline, read-only', () => {
    const doc = video();
    const rows = layerRows(NODES, { nodeId: 'm1', doc }, { m2: frameRows(doc, 'm2') });
    const closed = rows.filter((r) => r.nodeId === 'm2' && r.depth > 0);

    expect(closed.map((r) => r.id)).toEqual(rows.filter((r) => r.nodeId === 'm1' && r.depth > 0).map((r) => r.id));
    expect(closed.every((r) => r.nested)).toBe(true);
  });

  it('a folded frame keeps only its own row; the others stay unfolded', () => {
    const doc = video();
    const rows = layerRows(NODES, { nodeId: 'm1', doc }, { m2: frameRows(doc, 'm2') }, new Set(['m1']));

    expect(rows.filter((r) => r.nodeId === 'm1').map((r) => r.id)).toEqual(['m1']);
    expect(rows.some((r) => r.nodeId === 'm2' && r.depth > 0)).toBe(true);
  });

  it('the open frame reads its live doc, never the stored outline', () => {
    const doc = video();
    const rows = layerRows(NODES, { nodeId: 'm1', doc }, { m1: [] });

    expect(rows.find((r) => r.id === 't1' && r.nodeId === 'm1')).toMatchObject({ nested: false });
  });
});

describe('poster parts in layers', () => {
  it('lists the tagged parts of a clip under it, one level deeper, as part rows', () => {
    const doc = video();
    const rows = layerRows(NODES, { nodeId: 'm1', doc, parts: { t1: ['lines:0', 'footer1'] } });
    const clip = rows.findIndex((r) => r.id === 't1');

    expect(rows.slice(clip + 1, clip + 3).map((r) => [r.id, r.kind, r.depth, r.label])).toEqual([
      ['t1#lines:0', LayerKind.Part, 3, 'Line 1'],
      ['t1#footer1', LayerKind.Part, 3, 'Footer1']
    ]);
  });

  it('names a poster and its parts as people read them, photos typed as images', () => {
    const doc = TYPE_GRID_POSTER_TEMPLATE.template.doc;
    const rows = layerRows(NODES, { nodeId: 'm1', doc, parts: { [TYPE_GRID_CLIP]: ['lines:1', 'photos:0', 'arrow:4'] } });
    const at = rows.findIndex((r) => r.id === TYPE_GRID_CLIP);

    expect(rows[at].label).toBe('Type grid poster');
    expect(rows.slice(at + 1, at + 4).map((r) => [r.label, r.type])).toEqual([
      ['NAME', 'text'],
      ['Photo 1', 'image'],
      ['Arrow', 'arrow']
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

  it('click picks one, shift or ⌘ adds and removes, as on the canvas', () => {
    expect(pickFor({ shift: false, mod: false })).toBe(Pick.One);
    expect(pickFor({ shift: true, mod: false })).toBe(Pick.Toggle);
    expect(pickFor({ shift: false, mod: true })).toBe(Pick.Toggle);
    expect(pickLayers(['a'], 'c', Pick.One)).toEqual(['c']);
    expect(pickLayers(['a'], 'c', Pick.Toggle)).toEqual(['a', 'c']);
    expect(pickLayers(['a', 'c'], 'a', Pick.Toggle)).toEqual(['c']);
  });

  it('a row picked in Layers is no longer selected once the canvas selects another node', () => {
    expect(selectedLayers({ canvas: ['n1'], video: null })).toEqual(['n1']);
    expect(selectedLayers({ canvas: ['m1'], video: null })).toEqual(['m1']);
  });

  it('inside an open frame the picked clips stand in for the frame, and a part for its clip', () => {
    expect(selectedLayers({ canvas: ['m1'], video: { nodeId: 'm1', selection: [], part: null } })).toEqual(['m1']);
    expect(selectedLayers({ canvas: ['m1'], video: { nodeId: 'm1', selection: ['t1', 't2'], part: null } })).toEqual(['t1', 't2']);
    expect(selectedLayers({ canvas: ['m1'], video: { nodeId: 'm1', selection: ['poster'], part: 'poster#title' } })).toEqual(['poster#title']);
  });
});

describe('a picked row belongs to one frame', () => {
  it('a clip picked in the open frame does not light up the same clip id in a closed frame', () => {
    const doc = video();
    const rows = layerRows(NODES, { nodeId: 'm1', doc }, { m2: frameRows(doc, 'm2') });
    const selection = { canvas: ['m1'], video: { nodeId: 'm1', selection: ['t1'], part: null } };

    expect(rows.filter((r) => rowPicked(r, selection)).map((r) => [r.nodeId, r.id])).toEqual([['m1', 't1']]);
  });
});

describe('hovering a layer row', () => {
  it('outlines the node itself, or a closed frame for any of its children', () => {
    expect(tileHovered({ nodeId: 'n1', id: 'n1' }, 'n1', null)).toBe(true);
    expect(tileHovered({ nodeId: 'm2', id: 't1' }, 'm2', 'm1')).toBe(true);
    expect(tileHovered({ nodeId: 'm1', id: 't1' }, 'm1', 'm1')).toBe(false);
    expect(tileHovered({ nodeId: 'n1', id: 'n1' }, 'm1', null)).toBe(false);
    expect(tileHovered(null, 'n1', null)).toBe(false);
  });

  it('inside the open frame outlines the child or part, never the frame', () => {
    expect(frameHover({ nodeId: 'm1', id: 't1' }, 'm1')).toBe('t1');
    expect(frameHover({ nodeId: 'm1', id: 'poster#title' }, 'm1')).toBe('poster#title');
    expect(frameHover({ nodeId: 'm1', id: 'm1' }, 'm1')).toBeNull();
    expect(frameHover({ nodeId: 'm2', id: 't1' }, 'm1')).toBeNull();
  });
});

describe('the rows inside a picked row are tinted with it', () => {
  const row = (key: string, depth: number) => ({ key, depth });

  it('every deeper row right after a picked row is inside it, up to the next sibling', () => {
    const rows = [row('a', 0), row('b', 1), row('c', 2), row('d', 1), row('e', 0)];
    expect([...rowsInside(rows, (r) => r.key === 'b')]).toEqual(['c']);
    expect([...rowsInside(rows, (r) => r.key === 'a')]).toEqual(['b', 'c', 'd']);
  });

  it('nothing is inside when nothing is picked', () => {
    expect(rowsInside([row('a', 0), row('b', 1)], () => false).size).toBe(0);
  });
});
