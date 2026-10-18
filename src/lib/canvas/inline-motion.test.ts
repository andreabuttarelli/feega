import { describe, expect, it } from 'vitest';
import { Reframe, reframesOn, NEIGHBOUR_WHILE_EDITING, NodeMode, Opening, Paint, Part, dismissedAfterClick, editorOn, inlineMotionTarget, nodeLayers, openingOf, ownPlayer, tileMode } from './inline-motion';
import { Viewport } from '$lib/motion/editor-layout';

const rows = [
  { id: 'm1', type: 'motion' },
  { id: 'm2', type: 'motion' },
  { id: 't1', type: 'text' }
];

describe('inline motion target', () => {
  it('opens the editor for exactly one selected motion node', () => {
    expect(inlineMotionTarget(['m1'], rows, null, Opening.OnSelect)).toBe('m1');
  });

  it('stays closed for anything else selected, or more than one node', () => {
    expect(inlineMotionTarget([], rows, null, Opening.OnSelect)).toBeNull();
    expect(inlineMotionTarget(['t1'], rows, null, Opening.OnSelect)).toBeNull();
    expect(inlineMotionTarget(['m1', 'm2'], rows, null, Opening.OnSelect)).toBeNull();
  });

  it('stays closed for the node dismissed with Esc until another is picked', () => {
    expect(inlineMotionTarget(['m1'], rows, 'm1', Opening.OnSelect)).toBeNull();
    expect(inlineMotionTarget(['m2'], rows, 'm1', Opening.OnSelect)).toBe('m2');
  });
});

describe('opening the editor by viewport', () => {
  it('a tap on a phone only selects the frame, so it moves like any node; desktop and tablet open on select', () => {
    expect(openingOf(Viewport.Phone)).toBe(Opening.OnRequest);
    expect(openingOf(Viewport.Tablet)).toBe(Opening.OnSelect);
    expect(openingOf(Viewport.Desktop)).toBe(Opening.OnSelect);
  });

  it('on a phone the editor opens only for the selected frame whose Open editor was pressed', () => {
    expect(inlineMotionTarget(['m1'], rows, null, Opening.OnRequest)).toBeNull();
    expect(inlineMotionTarget(['m1'], rows, null, Opening.OnRequest, 'm1')).toBe('m1');
    expect(inlineMotionTarget(['m1'], rows, null, Opening.OnRequest, 'm2')).toBeNull();
    expect(inlineMotionTarget(['m1'], rows, 'm1', Opening.OnRequest, 'm1')).toBeNull();
  });
});

describe('the node picture while the editor opens', () => {
  it('keeps its own picture until the editor has drawn, then lets the editor take over: never a black gap', () => {
    expect(nodeLayers(NodeMode.Preview, Paint.Pending)).toEqual({ own: true, editor: false });
    expect(nodeLayers(NodeMode.Edit, Paint.Pending)).toEqual({ own: true, editor: false });
    expect(nodeLayers(NodeMode.Edit, Paint.Shown)).toEqual({ own: true, editor: true });
    expect(nodeLayers(NodeMode.Edit, Paint.Swapped)).toEqual({ own: false, editor: true });
  });
});

describe('the node player while the editor opens', () => {
  it('a frame playing or capturing its first frame keeps that picture until the editor draws, not a black stage', () => {
    expect(ownPlayer(NodeMode.Edit, Paint.Pending, true)).toBe(true);
    expect(ownPlayer(NodeMode.Edit, Paint.Shown, true)).toBe(true);
    expect(ownPlayer(NodeMode.Edit, Paint.Swapped, true)).toBe(false);
    expect(ownPlayer(NodeMode.Preview, Paint.Pending, true)).toBe(true);
    expect(ownPlayer(NodeMode.Edit, Paint.Pending, false)).toBe(false);
  });

});

describe('the other nodes while a frame is edited on a phone', () => {
  it('stay on the canvas, at most slightly dimmed; only their labels and ports go, which clipped at the edge', () => {
    expect(NEIGHBOUR_WHILE_EDITING[Part.Body]).toBeGreaterThanOrEqual(0.75);
    expect(NEIGHBOUR_WHILE_EDITING[Part.Edges]).toBeGreaterThanOrEqual(0.75);
    expect(NEIGHBOUR_WHILE_EDITING[Part.Label]).toBe(0);
    expect(NEIGHBOUR_WHILE_EDITING[Part.Ports]).toBe(0);
  });
});

describe('the canvas around an opening editor', () => {
  it('stays put on desktop; a phone or tablet frames the node in the room the panels leave', () => {
    expect(reframesOn(Viewport.Desktop)).toBe(Reframe.Stay);
    expect(reframesOn(Viewport.Tablet)).toBe(Reframe.Frame);
    expect(reframesOn(Viewport.Phone)).toBe(Reframe.Frame);
  });
});

describe('a frame closed and clicked again', () => {
  it('opens again: the click undoes the close, even though the frame never left the selection', () => {
    const dismissed = dismissedAfterClick('m1', 'm1');
    expect(inlineMotionTarget(['m1'], [{ id: 'm1', type: 'motion' }], dismissed, Opening.OnSelect)).toBe('m1');
  });

  it('a click on another node leaves the closed frame closed', () => {
    expect(dismissedAfterClick('m1', 'other')).toBe('m1');
  });
});

describe('a frame being closed', () => {
  it('keeps its editor on the tile until the tile has drawn itself, and the next frame waits', () => {
    expect(editorOn('m2', 'm1')).toBe('m1');
    expect(editorOn('m2', null)).toBe('m2');
    expect(tileMode('m1', 'm2', 'm1')).toBe(NodeMode.Leaving);
    expect(tileMode('m2', 'm2', 'm1')).toBe(NodeMode.Preview);
    expect(tileMode('m2', 'm2', null)).toBe(NodeMode.Edit);
    expect(tileMode('m3', 'm2', null)).toBe(NodeMode.Preview);
  });

  it('draws both its own picture and the editor over it', () => {
    expect(nodeLayers(NodeMode.Leaving, Paint.Swapped)).toEqual({ own: true, editor: true });
    expect(nodeLayers(NodeMode.Leaving, Paint.Pending)).toEqual({ own: true, editor: true });
  });
});
