import { describe, expect, it } from 'vitest';
import { Depth, FramePress, Gesture, Press, Under, depthOf, drill, pressOf, type Level, type Probe } from './drill';

const CANVAS: Level = { depth: Depth.Canvas, clip: null, part: null };
const FRAME: Level = { depth: Depth.Frame, clip: null, part: null };
const TITLE: Level = { depth: Depth.Clip, clip: 'title', part: null };
const LINE: Level = { depth: Depth.Part, clip: 'title', part: 'lines:0' };

const PARTS: Record<string, string[]> = { title: ['lines:0', 'lines:1'], photo: [] };

const over = (top: string | null, part: string | null = null, picked = top): Probe => ({
  top,
  picked,
  partOf: (clip) => (clip === top ? part : null),
  firstClip: 'title',
  firstPart: (clip) => PARTS[clip]?.[0] ?? null,
  editable: (clip, p) => clip === 'title' && p !== null
});

const nothing = over(null);

describe('depth of a selection', () => {
  it('reads canvas, frame, clip and part from what is selected', () => {
    expect(depthOf({ open: false, clip: null, part: null })).toBe(Depth.Canvas);
    expect(depthOf({ open: true, clip: null, part: null })).toBe(Depth.Frame);
    expect(depthOf({ open: true, clip: 'a', part: null })).toBe(Depth.Clip);
    expect(depthOf({ open: true, clip: 'a', part: 'p' })).toBe(Depth.Part);
  });
});

describe('a press on a frame selected on the canvas', () => {
  it('picks the child under the pointer so it moves without entering the frame', () => {
    expect(pressOf(Depth.Frame, FramePress.Move, Under.Child)).toBe(Press.Pick);
  });

  it('sweeps a marquee from the background of a frame that has children', () => {
    expect(pressOf(Depth.Frame, FramePress.Move, Under.Bare)).toBe(Press.Marquee);
    expect(pressOf(Depth.Clip, FramePress.Move, Under.Bare)).toBe(Press.Marquee);
    expect(pressOf(Depth.Part, FramePress.Move, Under.Bare)).toBe(Press.Marquee);
  });

  it('moves the whole frame when it has nothing to sweep', () => {
    expect(pressOf(Depth.Frame, FramePress.Move, Under.Empty)).toBe(Press.MoveFrame);
    expect(pressOf(Depth.Clip, FramePress.Move, Under.Empty)).toBe(Press.MoveFrame);
  });

  it('picks a child once inside, whatever the depth', () => {
    expect(pressOf(Depth.Clip, FramePress.Move, Under.Child)).toBe(Press.Pick);
    expect(pressOf(Depth.Part, FramePress.Move, Under.Child)).toBe(Press.Pick);
  });

  it('never moves the host of a node that does not move on press', () => {
    expect(pressOf(Depth.Frame, FramePress.Pick, Under.Empty)).toBe(Press.Marquee);
    expect(pressOf(Depth.Clip, FramePress.Pick, Under.Bare)).toBe(Press.Marquee);
  });
});

describe('click selects at the current level', () => {
  it('on a closed frame selects the direct child under the pointer: a frame is not a group', () => {
    expect(drill(CANVAS, Gesture.Click, over('title', 'lines:0')).level).toEqual(TITLE);
  });

  it('on the empty area of a closed frame selects the frame', () => {
    expect(drill(CANVAS, Gesture.Click, nothing).level).toEqual(FRAME);
  });

  it('inside the open frame selects the child under the pointer', () => {
    expect(drill(FRAME, Gesture.Click, over('title')).level).toEqual(TITLE);
  });

  it('on empty space inside the frame selects the frame again', () => {
    expect(drill(TITLE, Gesture.Click, nothing).level).toEqual(FRAME);
    expect(drill(LINE, Gesture.Click, nothing).level).toEqual(FRAME);
  });

  it('at clip level picks a sibling, not a part', () => {
    expect(drill(TITLE, Gesture.Click, over('photo')).level).toEqual({ depth: Depth.Clip, clip: 'photo', part: null });
    expect(drill(TITLE, Gesture.Click, over('title', 'lines:1')).level).toEqual(TITLE);
  });

  it('at part level picks a sibling part of the same clip', () => {
    expect(drill(LINE, Gesture.Click, over('title', 'lines:1')).level).toEqual({ ...LINE, part: 'lines:1' });
  });

  it('at part level outside the parts climbs to the clip under the pointer', () => {
    expect(drill(LINE, Gesture.Click, over('photo')).level).toEqual({ depth: Depth.Clip, clip: 'photo', part: null });
  });
});

describe('double-click goes one level deeper', () => {
  it('goes one level below what a click selects: child → part → text editing', () => {
    expect(drill(CANVAS, Gesture.Double, over('title', 'lines:0')).level).toEqual(LINE);
    expect(drill(FRAME, Gesture.Double, over('title', 'lines:0')).level).toEqual(LINE);
    expect(drill(FRAME, Gesture.Double, over('photo')).level).toEqual({ depth: Depth.Clip, clip: 'photo', part: null });
    expect(drill(TITLE, Gesture.Double, over('title', 'lines:0')).level).toEqual(LINE);
    expect(drill(LINE, Gesture.Double, over('title', 'lines:0'))).toEqual({ level: LINE, edit: true });
  });

  it('on a clip without a part under the pointer edits its text when it has some', () => {
    expect(drill(TITLE, Gesture.Double, over('title'))).toEqual({ level: TITLE, edit: false });
  });

  it('on another clip selects that clip at its own level', () => {
    expect(drill(TITLE, Gesture.Double, over('photo')).level).toEqual({ depth: Depth.Clip, clip: 'photo', part: null });
  });

  it('on empty space stays where it is', () => {
    expect(drill(FRAME, Gesture.Double, nothing).level).toEqual(FRAME);
  });
});

describe('a plain text, without parts', () => {
  const plain = (top: string | null): Probe => ({ ...over(top), firstPart: () => null, editable: (clip, p) => clip === 'words' && p === null });
  const WORDS: Level = { depth: Depth.Clip, clip: 'words', part: null };

  it('double-click edits it straight away, from the frame or the canvas', () => {
    expect(drill(FRAME, Gesture.Double, plain('words'))).toEqual({ level: WORDS, edit: true });
    expect(drill(CANVAS, Gesture.Double, plain('words'))).toEqual({ level: WORDS, edit: true });
  });

  it('Enter on it, selected, edits it', () => {
    expect(drill(WORDS, Gesture.Enter, plain(null))).toEqual({ level: WORDS, edit: true });
  });
});

describe('keyboard', () => {
  it('Enter goes deeper without a pointer', () => {
    expect(drill(CANVAS, Gesture.Enter, nothing).level).toEqual(FRAME);
    expect(drill(FRAME, Gesture.Enter, nothing).level).toEqual(TITLE);
    expect(drill(TITLE, Gesture.Enter, nothing).level).toEqual(LINE);
    expect(drill(LINE, Gesture.Enter, nothing)).toEqual({ level: LINE, edit: true });
  });

  it('Enter on a clip without parts stays on the clip', () => {
    const photo: Level = { depth: Depth.Clip, clip: 'photo', part: null };
    expect(drill(photo, Gesture.Enter, nothing).level).toEqual(photo);
  });

  it('Esc and Shift+Enter go back up one level', () => {
    expect(drill(LINE, Gesture.Leave, nothing).level).toEqual(TITLE);
    expect(drill(TITLE, Gesture.Leave, nothing).level).toEqual(FRAME);
    expect(drill(FRAME, Gesture.Leave, nothing).level).toEqual(CANVAS);
    expect(drill(CANVAS, Gesture.Leave, nothing).level).toEqual(CANVAS);
  });
});

describe('⌘-click deep-selects', () => {
  it('lands on the innermost element from any level', () => {
    for (const from of [CANVAS, FRAME, TITLE, LINE]) {
      expect(drill(from, Gesture.Deep, over('title', 'lines:1')).level).toEqual({ ...LINE, part: 'lines:1' });
    }
  });

  it('stops at the clip when it has no part there', () => {
    expect(drill(CANVAS, Gesture.Deep, over('photo')).level).toEqual({ depth: Depth.Clip, clip: 'photo', part: null });
  });

  it('on empty space selects the frame', () => {
    expect(drill(TITLE, Gesture.Deep, nothing).level).toEqual(FRAME);
  });
});

describe('hover outlines what a double-click would reach', () => {
  it('outlines a child before the frame is entered', () => {
    expect(drill(CANVAS, Gesture.Hover, over('title', 'lines:0')).level).toEqual(TITLE);
  });

  it('at clip level outlines the clip a click would pick, never its part', () => {
    expect(drill(TITLE, Gesture.Hover, over('title', 'lines:1')).level).toEqual(TITLE);
  });

  it('at part level outlines the sibling part a click would pick', () => {
    expect(drill(LINE, Gesture.Hover, over('title', 'lines:1')).level).toEqual({ ...LINE, part: 'lines:1' });
  });

  it('always predicts the click', () => {
    for (const from of [CANVAS, FRAME, TITLE, LINE]) {
      for (const probe of [over('title', 'lines:1'), over('photo'), nothing]) {
        expect(drill(from, Gesture.Hover, probe).level).toEqual(drill(from, Gesture.Click, probe).level);
      }
    }
  });

  it('outlines a sibling clip at clip level', () => {
    expect(drill(LINE, Gesture.Hover, over('photo')).level).toEqual({ depth: Depth.Clip, clip: 'photo', part: null });
  });

  it('outlines nothing over empty space', () => {
    expect(drill(TITLE, Gesture.Hover, nothing).level).toEqual(FRAME);
  });
});
