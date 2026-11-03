import { describe, expect, it } from 'vitest';
import { Depth, Gesture } from '$lib/motion/drill';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { Extend, Reach, clickTarget, extendOf, frameLevel, grabbedInstead, ownClipToPick, siblingsOf, stepInside, videoSide, Press, pressOn } from './frame-select';

const FRAME = frameLevel();
const clipLevel = (clip: string) => ({ depth: Depth.Clip, clip, part: null });

describe('stepInside', () => {
  it('a click on an element selects it', () => {
    expect(stepInside(FRAME, Gesture.Click, 'card')).toEqual(clipLevel('card'));
  });

  it('a click on the bare frame selects the frame', () => {
    expect(stepInside(clipLevel('card'), Gesture.Click, null)).toEqual(FRAME);
  });

  it('a double click drills into the element under the pointer', () => {
    expect(stepInside(clipLevel('group'), Gesture.Double, 'child')).toEqual(clipLevel('child'));
  });

  it('Esc goes up from the element to the frame, then to the canvas', () => {
    expect(stepInside(clipLevel('card'), Gesture.Leave, null)).toEqual(FRAME);
    expect(stepInside(FRAME, Gesture.Leave, null).depth).toBe(Depth.Canvas);
  });
});

describe('videoSide', () => {
  it('serves the layers panel the frame doc and selecting there selects the element', () => {
    const doc = newMotionDoc(MotionFormat.Landscape);
    let selection: string[] = [];
    const side = videoSide({ nodeId: 'n1', doc: () => doc, selection: () => selection, select: (ids) => (selection = ids), edit: () => {}, run: () => {} });

    side.select(['card']);

    expect(side.nodeId).toBe('n1');
    expect(side.doc).toBe(doc);
    expect(side.selection).toEqual(['card']);
  });
});

describe('ownClipToPick', () => {
  it('picks the own clip of a free element whose doc arrived after the selection', () => {
    expect(ownClipToPick(null, 'e1', 'shape')).toBe('shape');
  });

  it('leaves a clip the user deselected alone', () => {
    expect(ownClipToPick('e1', 'e1', 'shape')).toBeNull();
  });

  it('picks nothing while the doc has not arrived', () => {
    expect(ownClipToPick(null, 'e1', undefined)).toBeNull();
  });
});

describe('videoSide parts', () => {
  it('picking a poster part keeps the part for the properties panel', () => {
    const doc = newMotionDoc(MotionFormat.Landscape);
    let picked: { clip: string; part: string } | null = null;
    const side = videoSide({ nodeId: 'n1', doc: () => doc, selection: () => ['card'], part: () => 'lines.0', select: () => {}, selectPart: (clip, part) => (picked = { clip, part }), edit: () => {}, run: () => {} });

    side.selectPart('card', 'lines.0');

    expect(picked).toEqual({ clip: 'card', part: 'lines.0' });
    expect(side.part).toBe('card#lines.0');
  });
});

const clip = (id: string, parent: string | null) => ({ id, component: 'Shape', from: 0, durationInFrames: 30, props: {}, parent });

function nested() {
  const doc = newMotionDoc(MotionFormat.Square);
  return { ...doc, tracks: [{ id: 't', kind: 'visual', name: 'T', clips: [clip('outer', null), clip('inner', 'outer'), clip('leaf', 'inner'), clip('other', null)] }] } as unknown as typeof doc;
}

describe('clickTarget', () => {
  it('a click selects the outermost container, like Figma', () => {
    expect(clickTarget(nested(), 'leaf', [], Reach.Top)).toBe('outer');
  });

  it('a click stays at the depth of the current pick', () => {
    expect(clickTarget(nested(), 'leaf', ['inner'], Reach.Top)).toBe('inner');
  });

  it('a cmd-click selects the deepest element', () => {
    expect(clickTarget(nested(), 'leaf', [], Reach.Deep)).toBe('leaf');
  });
});

describe('siblingsOf', () => {
  it('selects every element sharing the parent of the pick', () => {
    expect(siblingsOf(nested(), ['leaf'])).toEqual(['leaf']);
    expect(siblingsOf(nested(), ['other']).sort()).toEqual(['other', 'outer']);
  });
});

describe('grabbedInstead', () => {
  it('a press on an image lying over the one selected shape grabs the image', () => {
    expect(grabbedInstead(['shape'], 'image')).toBe('image');
  });

  it('a press on the selected element keeps the selection', () => {
    expect(grabbedInstead(['shape'], 'shape')).toBeNull();
  });

  it('a press inside a multiple selection drags the whole selection, like Figma', () => {
    expect(grabbedInstead(['a', 'b'], 'c')).toBeNull();
  });

  it('a press on nothing keeps the selection', () => {
    expect(grabbedInstead(['shape'], null)).toBeNull();
  });
});

describe('pressOn', () => {
  const page = 'page';
  const nested = 'card/button';

  it('frame selezionato + trascinamento dentro = si muove il frame, non il figlio', () => {
    expect(pressOn({ selected: [page], inside: null, picks: [] }, page, Reach.Top)).toBe(Press.Host);
    expect(pressOn({ selected: [page], inside: page, picks: [] }, page, Reach.Top)).toBe(Press.Host);
  });

  it('un figlio annidato sotto il cursore non ruba il frame selezionato', () => {
    expect(pressOn({ selected: ['other', page], inside: null, picks: [] }, page, Reach.Top)).toBe(Press.Host);
  });

  it('frame non selezionato: il clic prende il figlio come prima', () => {
    expect(pressOn({ selected: [], inside: null, picks: [] }, page, Reach.Top)).toBe(Press.Child);
  });

  it('figlio già scelto: si lavora dentro il frame', () => {
    expect(pressOn({ selected: [page], inside: page, picks: [nested] }, page, Reach.Top)).toBe(Press.Child);
  });

  it('Cmd/Ctrl prende sempre il figlio', () => {
    expect(pressOn({ selected: [page], inside: null, picks: [] }, page, Reach.Deep)).toBe(Press.Child);
  });
});

describe('extendOf', () => {
  const at = { onClip: true, onBody: true, held: false, entered: false, selectedElsewhere: false, picks: 0, bandable: true };
  const plain = { shift: false, mod: false };
  const background = { ...at, onClip: false };

  it('a drag on the background of a frame that is not selected is a marquee over its children', () => {
    expect(extendOf(plain, background)).toEqual({ extend: Extend.Band, reach: Reach.Top });
  });

  it('a drag on the background of a selected frame moves it', () => {
    expect(extendOf(plain, { ...background, held: true, entered: true }).extend).toBe(Extend.None);
  });

  it('a drag on the frame title moves it', () => {
    expect(extendOf(plain, { ...background, onBody: false }).extend).toBe(Extend.None);
    expect(extendOf({ shift: false, mod: true }, { ...background, onBody: false }).extend).toBe(Extend.None);
  });

  it('a drag on an empty frame or a group moves it', () => {
    expect(extendOf(plain, { ...background, bandable: false }).extend).toBe(Extend.None);
  });

  it('shift-click on a child of a frame nobody picked picks the child, not the frame', () => {
    expect(extendOf({ shift: true, mod: false }, at)).toEqual({ extend: Extend.Toggle, reach: Reach.Top });
  });

  it('shift-press on the background of a frame starts a marquee over its children', () => {
    expect(extendOf({ shift: true, mod: false }, { ...at, onClip: false })).toEqual({ extend: Extend.Band, reach: Reach.Top });
  });

  it('shift leaves other selected nodes to the canvas', () => {
    expect(extendOf({ shift: true, mod: false }, { ...at, selectedElsewhere: true }).extend).toBe(Extend.None);
  });

  it('⌘-click adds the deepest child when children are already picked', () => {
    expect(extendOf({ shift: false, mod: true }, { ...at, entered: true, picks: 1 })).toEqual({ extend: Extend.Toggle, reach: Reach.Deep });
  });

  it('⌘-click with nothing picked is a deep pick, not an extension', () => {
    expect(extendOf({ shift: false, mod: true }, at).extend).toBe(Extend.None);
  });

  it('⌘-drag on the frame background marquees the deepest children instead of moving the frame', () => {
    expect(extendOf({ shift: false, mod: true }, { ...at, onClip: false, selectedElsewhere: true })).toEqual({ extend: Extend.Band, reach: Reach.Deep });
  });

  it('⇧⌘-click toggles the deepest child', () => {
    expect(extendOf({ shift: true, mod: true }, at)).toEqual({ extend: Extend.Toggle, reach: Reach.Deep });
  });

  it('a plain press extends nothing', () => {
    expect(extendOf({ shift: false, mod: false }, { ...at, entered: true, picks: 2 }).extend).toBe(Extend.None);
  });
});
