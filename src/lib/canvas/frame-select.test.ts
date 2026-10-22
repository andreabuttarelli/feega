import { describe, expect, it } from 'vitest';
import { Depth, Gesture } from '$lib/motion/drill';
import { MotionFormat, newMotionDoc } from '$lib/motion/doc';
import { frameLevel, ownClipToPick, stepInside, videoSide } from './frame-select';

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
    const side = videoSide({ nodeId: 'n1', doc: () => doc, selection: () => selection, select: (ids) => (selection = ids), edit: () => {} });

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
    const side = videoSide({ nodeId: 'n1', doc: () => doc, selection: () => ['card'], part: () => 'lines.0', select: () => {}, selectPart: (clip, part) => (picked = { clip, part }), edit: () => {} });

    side.selectPart('card', 'lines.0');

    expect(picked).toEqual({ clip: 'card', part: 'lines.0' });
    expect(side.part).toBe('card#lines.0');
  });
});
