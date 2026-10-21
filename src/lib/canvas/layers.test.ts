import { describe, expect, it } from 'vitest';
import { LAYER_MENU, LayerAction, LayerKind, NodeIcon, Pick, Place, restack, dropLayer, dropLayers, dropPlace, nodeIcon, frameHover, frameRows, rowPicked, rowsInside, searchRows, tileHovered, layerEdit, layerKey, layerRows, pickFor, pickLayers, selectedLayers } from './layers';
import { MotionFormat, newMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip, addTrack } from '$lib/motion/timeline';
import { TrackKind } from '$lib/motion/components';
import { EditMode } from '$lib/motion/edit-mode';
import { maskMembers, useAsMask } from '$lib/motion/mask-group';
import { Command } from '$lib/motion/shortcuts';
import { CUSTOM_CLIP } from '$lib/motion/poster-parts';
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
  it('list every canvas node at the top level, named, and only the open video unfolds into its clips', () => {
    const doc = video();
    const rows = layerRows(NODES, { nodeId: 'm1', doc });

    expect(rows.filter((r) => r.depth === 0).map((r) => [r.id, r.kind, r.label])).toEqual([
      ['n1', LayerKind.Node, 'Hook'],
      ['m1', LayerKind.Node, 'Teaser'],
      ['m2', LayerKind.Node, 'Frame']
    ]);
    expect(rows.filter((r) => r.nodeId === 'm1' && r.depth > 0).map((r) => [r.id, r.kind])).toEqual([['t1', LayerKind.Clip]]);
    expect(rows.find((r) => r.id === 't1')).toMatchObject({ depth: 1, label: 'Title' });
    expect(rows.some((r) => r.nodeId === 'm2' && r.depth > 0)).toBe(false);
  });

  it('shows a free element as one row, never a frame with the element inside', () => {
    const doc = video();
    const rows = layerRows([{ id: 'e1', type: 'motion', name: 'Rectangle', element: true }], { nodeId: 'e1', doc }, { e1: frameRows(doc, 'e1') });

    expect(rows.map((r) => [r.id, r.kind, r.label, r.nodeId])).toEqual([['e1', LayerKind.Node, 'Rectangle', 'e1']]);
  });

  it('picks the one element row while its shape is selected inside it', () => {
    const doc = video();
    const [row] = layerRows([{ id: 'e1', type: 'motion', name: 'Rectangle', element: true }], { nodeId: 'e1', doc });

    expect(rowPicked(row, { canvas: [], video: { nodeId: 'e1', selection: ['t1'], part: null } })).toBe(true);
    expect(rowPicked(row, { canvas: [], video: { nodeId: 'e2', selection: ['t1'], part: null } })).toBe(false);
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

describe('a group folds like a frame', () => {
  it('a group row says it folds; folded by its key, its insides are not listed', () => {
    const doc = video();
    const inner = { id: 'in', kind: TrackKind.Visual, name: 'Inner', clips: [{ ...doc.tracks[0].clips[0], id: 'deep' }] };
    const grouped: MotionDoc = {
      ...doc,
      comps: { g1: { name: 'Group 1', durationInFrames: 30, tracks: [inner] } as never },
      tracks: doc.tracks.map((t, i) => (i === 0 ? { ...t, clips: [{ ...t.clips[0], id: 'g', component: 'Precomp', props: { comp: 'g1' } }] } : t))
    };
    const open = { nodeId: 'm1', doc: grouped };
    const group = layerRows(NODES, open).find((r) => r.id === 'g')!;

    expect(group.foldable).toBe(true);
    expect(group.label).toBe('Group 1');
    expect(layerRows(NODES, open).some((r) => r.id === 'deep')).toBe(true);
    expect(layerRows(NODES, open, {}, new Set([group.key])).some((r) => r.id === 'deep')).toBe(false);
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
      ['t1#lines:0', LayerKind.Part, 2, 'Line 1'],
      ['t1#footer1', LayerKind.Part, 2, 'Footer1']
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

  it('an open poster keeps the parts its outline names while nothing has measured it', () => {
    const doc = video();
    const outline = { m1: [{ id: 't1#lines:0', key: 't1#lines:0', kind: LayerKind.Part, depth: 2, label: 'Line 1', type: 'text', nodeId: 'm1', hidden: false, locked: false, nested: false }] };
    const rows = layerRows(NODES, { nodeId: 'm1', doc, parts: {} }, outline);

    expect(rows.map((r) => r.id)).toContain('t1#lines:0');
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

const clipOf = (doc: MotionDoc, id: string, from: number) => ({ ...doc.tracks.flatMap((t) => t.clips)[0], id, from });

function sequence(): MotionDoc {
  const doc = video();
  return {
    ...doc,
    tracks: [
      { id: 'v2', kind: TrackKind.Visual, name: 'Video 2', clips: [clipOf(doc, 'a', 0), clipOf(doc, 'b', 60)] },
      { id: 'v1', kind: TrackKind.Visual, name: 'Video 1', clips: [clipOf(doc, 'c', 0)] },
      { id: 'a1', kind: TrackKind.Audio, name: 'Audio 1', clips: [] }
    ]
  };
}

const inside = (rows: ReturnType<typeof layerRows>) => rows.filter((r) => r.nodeId === 'm1' && r.depth > 0).map((r) => [r.id, r.kind, r.depth]);

describe('a frame lists elements, not timeline tracks', () => {
  it('never shows an empty track', () => {
    expect(layerRows(NODES, { nodeId: 'm1', doc: video() }).some((r) => r.kind === LayerKind.Track)).toBe(false);
  });

  it('lists clips straight under the frame, top track first', () => {
    expect(inside(layerRows(NODES, { nodeId: 'm1', doc: sequence(), mode: EditMode.Design }))).toEqual([
      ['a', LayerKind.Clip, 1],
      ['b', LayerKind.Clip, 1],
      ['c', LayerKind.Clip, 1]
    ]);
  });

  it('in Motion mode a track holding clips in sequence becomes a group named by its content', () => {
    const rows = layerRows(NODES, { nodeId: 'm1', doc: sequence(), mode: EditMode.Motion });

    expect(inside(rows)).toEqual([
      ['v2', LayerKind.Track, 1],
      ['a', LayerKind.Clip, 2],
      ['b', LayerKind.Clip, 2],
      ['c', LayerKind.Clip, 1]
    ]);
    expect(rows.find((r) => r.id === 'v2')!.label).toBe('Title');
  });

  it('a group keeps a name its owner gave the track, and falls back to its place when unnamed', () => {
    const doc = sequence();
    const named: MotionDoc = { ...doc, tracks: doc.tracks.map((t) => (t.id === 'v2' ? { ...t, name: 'Captions' } : t)) };
    const blank: MotionDoc = { ...doc, tracks: doc.tracks.map((t) => (t.id === 'v2' ? { ...t, name: '', clips: t.clips.map((c) => ({ ...c, component: CUSTOM_CLIP, props: { name: '' } })) } : t)) };

    expect(layerRows(NODES, { nodeId: 'm1', doc: named, mode: EditMode.Motion }).find((r) => r.id === 'v2')!.label).toBe('Captions');
    expect(layerRows(NODES, { nodeId: 'm1', doc: blank, mode: EditMode.Motion }).find((r) => r.id === 'v2')!.label).toBe('Track 1');
  });

  it('a stored outline of a closed frame is never grouped by track', () => {
    expect(frameRows(sequence(), 'm2').some((r) => r.kind === LayerKind.Track)).toBe(false);
  });

  it('an audio clip is a row of its own only when it exists', () => {
    const doc = sequence();
    const audio = clipOf(doc, 'snd', 0);
    const withAudio: MotionDoc = { ...doc, tracks: doc.tracks.map((t) => (t.id === 'a1' ? { ...t, clips: [{ ...audio, component: 'Audio' }] } : t)) };

    expect(layerRows(NODES, { nodeId: 'm1', doc: withAudio }).find((r) => r.id === 'snd')).toMatchObject({ kind: LayerKind.Clip, type: 'Audio', depth: 1 });
  });

  it('a template poster is a group row holding its parts', () => {
    const doc = TYPE_GRID_POSTER_TEMPLATE.template.doc;
    const rows = layerRows(NODES, { nodeId: 'm1', doc, parts: { [TYPE_GRID_CLIP]: ['lines:1'] } });
    const group = rows.find((r) => r.id === TYPE_GRID_CLIP)!;

    expect(group).toMatchObject({ kind: LayerKind.Group, type: CUSTOM_CLIP, label: 'Type grid poster', depth: 1 });
    expect(rows.find((r) => r.id === `${TYPE_GRID_CLIP}#lines:1`)!.depth).toBe(2);
    expect(rows.some((r) => r.kind === LayerKind.Track)).toBe(false);
  });
});

describe('a frame row shows what the frame looks like', () => {
  it('carries the stored poster as its thumbnail', () => {
    const rows = layerRows([{ id: 'm1', type: 'motion', name: null, poster: '/p/x/c/y/assets/a1' }], null);

    expect(rows[0].thumb).toBe('/p/x/c/y/assets/a1');
  });

  it('has no thumbnail when nothing was stored', () => {
    expect(layerRows(NODES, null)[1].thumb).toBeNull();
  });

  it('types a still frame apart from a video', () => {
    expect(nodeIcon({ type: 'motion', still: true })).toBe(NodeIcon.Still);
    expect(nodeIcon({ type: 'motion', still: false })).toBe(NodeIcon.Video);
    expect(nodeIcon({ type: 'text' })).toBe('text');
  });
});

const zOrder = (doc: MotionDoc) => doc.tracks.filter((t) => t.kind === TrackKind.Visual).map((t) => t.clips.map((c) => c.id).join('+')).filter(Boolean);
let ids = 0;
const nextId = () => `n${++ids}`;

describe('dragging a row restacks the frame, with no track in sight', () => {
  it('a clip alone on its track dropped above another clip moves its whole track there', () => {
    const doc = ok(restack(sequence(), 'c', 'a', Place.Above, nextId));

    expect(zOrder(doc)).toEqual(['c', 'a+b']);
    expect(doc.tracks.length).toBe(3);
  });

  it('a clip sharing its track gets a new track of its own, at the drop, keeping its time', () => {
    const doc = ok(restack(sequence(), 'b', 'c', Place.Below, nextId));

    expect(zOrder(doc)).toEqual(['a', 'c', 'b']);
    expect(doc.tracks.flatMap((t) => t.clips).find((c) => c.id === 'b')!.from).toBe(60);
  });

  it('dropped onto a group, a clip joins that track', () => {
    expect(zOrder(ok(restack(sequence(), 'c', 'v2', Place.Into, nextId)))).toEqual(['a+b+c']);
  });

  it('dragging a clip out of a group above it lifts it to its own track', () => {
    expect(zOrder(ok(restack(sequence(), 'b', 'a', Place.Above, nextId)))).toEqual(['b', 'a', 'c']);
  });

  it('a group dropped below a clip moves its track under that clip', () => {
    expect(zOrder(ok(restack(sequence(), 'v2', 'c', Place.Below, nextId)))).toEqual(['c', 'a+b']);
  });

  it('refuses a clip among tracks of another kind, nested rows, and itself', () => {
    const doc = sequence();
    const audio: MotionDoc = { ...doc, tracks: doc.tracks.map((t) => (t.id === 'a1' ? { ...t, clips: [{ ...clipOf(doc, 'snd', 0), component: 'Audio' }] } : t)) };

    expect(restack(audio, 'snd', 'a', Place.Above, nextId).ok).toBe(false);
    expect(restack(doc, 'a', 'a', Place.Above, nextId).ok).toBe(false);
    expect(restack(doc, 'nope', 'a', Place.Above, nextId).ok).toBe(false);
  });

  it('⌘] on a clip with no track above makes one, so the key always works', () => {
    const doc = ok(layerEdit(sequence(), 'a', LayerAction.Up, undefined, nextId));

    expect(zOrder(doc)).toEqual(['a', 'b', 'c']);
  });
});

describe('where a drop lands on a row', () => {
  it('the top half of a clip row is above it, the bottom half below', () => {
    expect(dropPlace(LayerKind.Clip, 0.2)).toBe(Place.Above);
    expect(dropPlace(LayerKind.Clip, 0.8)).toBe(Place.Below);
  });

  it('the middle of a group row drops into it', () => {
    expect(dropPlace(LayerKind.Track, 0.5)).toBe(Place.Into);
    expect(dropPlace(LayerKind.Track, 0.1)).toBe(Place.Above);
    expect(dropPlace(LayerKind.Track, 0.9)).toBe(Place.Below);
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

describe('searching the layers keeps a match where it lives', () => {
  const row = (key: string, depth: number, label: string) => ({ key, depth, label });
  const rows = [row('f', 0, 'Frame'), row('v', 1, 'Video 1'), row('t', 2, 'Title'), row('a', 1, 'Audio 1'), row('x', 0, 'Text')];

  it('a match brings its parents with it, so it is never shown out of place', () => {
    expect(searchRows(rows, 'title').map((r) => r.key)).toEqual(['f', 'v', 't']);
  });

  it('matching ignores case and spaces around the query', () => {
    expect(searchRows(rows, '  AUDIO ').map((r) => r.key)).toEqual(['f', 'a']);
  });

  it('an empty query shows every row', () => {
    expect(searchRows(rows, ' ')).toHaveLength(rows.length);
  });
});

describe('a mask in Layers', () => {
  function masked(): MotionDoc {
    let doc = ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, props: { shape: 'ellipse' } }, 'disc'));
    for (const [track, clip, component] of [['t2', 'photo', 'Image'], ['t3', 'title', 'Title'], ['t4', 'note', 'Title']] as const) {
      doc = ok(addClip(ok(addTrack(doc, TrackKind.Visual, track)), { component, from: 0, trackId: track, props: component === 'Image' ? { assetId: 'pic' } : {} }, clip));
    }
    return ok(useAsMask(doc, ['title', 'photo', 'disc']));
  }
  const tree = (doc: MotionDoc) => frameRows(doc, 'm1').map((r) => [r.id, r.kind, r.depth]);
  const membersOf = (doc: MotionDoc) => maskMembers(doc).get('disc') ?? [];

  it('the mask row carries the mask kind, its masked layers indented under it', () => {
    expect(tree(masked())).toEqual([
      ['note', LayerKind.Clip, 1],
      ['disc', LayerKind.Mask, 1],
      ['title', LayerKind.Clip, 2],
      ['photo', LayerKind.Clip, 2]
    ]);
  });

  it('a mask row takes drops into it, like a group', () => {
    expect(dropPlace(LayerKind.Mask, 0.5)).toBe(Place.Into);
  });

  it('a layer dropped into the mask is masked by it', () => {
    const doc = ok(dropLayer(masked(), 'note', 'disc', Place.Into));

    expect(membersOf(doc)).toContain('note');
    expect(tree(doc).find(([id]) => id === 'note')).toEqual(['note', LayerKind.Clip, 2]);
  });

  it('a layer dropped beside a masked layer joins its mask', () => {
    expect(membersOf(ok(dropLayer(masked(), 'note', 'photo', Place.Below)))).toContain('note');
  });

  it('a masked layer dragged out of the group is unmasked', () => {
    const doc = ok(dropLayer(masked(), 'photo', 'note', Place.Above));

    expect(membersOf(doc)).toEqual(['title']);
    expect(tree(doc)[0]).toEqual(['photo', LayerKind.Clip, 1]);
  });

  it('the right-click menu offers use as mask on a free stack and remove mask on a masked one', () => {
    const offered = (doc: MotionDoc, ids: string[]) => LAYER_MENU.filter((item) => item.op(doc, ids).ok).map((item) => item.command);

    expect(offered(masked(), ['photo'])).toEqual([Command.RemoveMask]);
    expect(offered(ok(dropLayer(masked(), 'photo', 'note', Place.Above)), ['note', 'photo'])).toEqual([Command.UseAsMask]);
  });

  it('the eye on the mask hides the mask, which turns masking off', () => {
    const doc = ok(layerEdit(masked(), 'disc', LayerAction.Hide));

    expect(frameRows(doc, 'm1').find((r) => r.id === 'disc')).toMatchObject({ kind: LayerKind.Mask, hidden: true });
  });
});

describe('dragging several layers at once', () => {
  function stacked(): MotionDoc {
    let doc = ok(addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, props: { shape: 'rect' } }, 'a'));
    for (const id of ['b', 'c', 'd']) {
      doc = ok(addClip(ok(addTrack(doc, TrackKind.Visual, `t-${id}`)), { component: 'Shape', from: 0, trackId: `t-${id}`, props: { shape: 'rect' } }, id));
    }
    return doc;
  }
  const order = (doc: MotionDoc) => frameRows(doc, 'm1').map((r) => r.id);

  it('lands the block above the target keeping its inner order', () => {
    const doc = stacked();
    const moved = ok(dropLayers(doc, ['a', 'c'], 'd', Place.Above, order(doc)));

    expect(order(moved).filter((id) => ['a', 'c', 'd'].includes(id))).toEqual(['c', 'a', 'd']);
  });

  it('lands the block below the target keeping its inner order', () => {
    const doc = stacked();
    const moved = ok(dropLayers(doc, ['c', 'a'], 'b', Place.Below, order(doc)));

    expect(order(moved).filter((id) => ['a', 'b', 'c'].includes(id))).toEqual(['b', 'c', 'a']);
  });

  it('ignores the target when it is part of the block', () => {
    const doc = stacked();

    expect(order(ok(dropLayers(doc, ['b', 'c'], 'c', Place.Above, order(doc))))).toEqual(order(ok(dropLayer(doc, 'b', 'c', Place.Above))));
  });
});
