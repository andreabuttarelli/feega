import { describe, expect, it } from 'vitest';
import { SelectionKind } from '$lib/canvas/frame-transform';
import { HighlightKind } from '$lib/canvas/highlight';
import { NodeChrome } from '$lib/canvas/selection-chrome';
import {
  MarkPart,
  hoverMark,
  markHit,
  markRect,
  marksJson,
  nodeMark,
  selectionMark,
  type MarkLook,
} from './canvas-marks';

const LOOK: MarkLook = { handleFill: '#1c1c1e', handleRadius: 2, dpr: 2 };
const BOX = { x: 10, y: 20, w: 100, h: 50 };

describe('canvas marks', () => {
  it('a hover ring is a boosted ring one pixel off the box, never hit', () => {
    const m = hoverMark({ id: 'n1', ...BOX, radius: 8 });
    expect(m).toMatchObject({
      id: 'n1',
      offset: 1,
      width: 1.5,
      radius: 8,
      boosted: true,
      body: false,
      edges: false,
      rotate: false,
    });
    expect(m.quad).toEqual([10, 20, 110, 20, 110, 70, 10, 70]);
  });

  it('a turned box turns its quad about its centre', () => {
    const m = hoverMark({ id: 'n1', x: 0, y: 0, w: 10, h: 10, rotation: 90 });
    expect(m.quad.map((v) => Math.round(v) + 0)).toEqual([
      10, 0, 10, 10, 0, 10, 0, 0,
    ]);
  });

  it('a selected node draws a ring with corner handles on it', () => {
    const m = nodeMark({
      id: 'n1',
      ...BOX,
      ring: NodeChrome.Selected,
      handles: true,
      ringColor: '#0099ff',
    });
    expect(m).toMatchObject({
      line: 'solid',
      handles: 'corners',
      onRing: true,
      edges: true,
      hitReach: 8,
      width: 2,
    });
  });

  it('a node being edited draws a faded dashed ring', () => {
    const m = nodeMark({
      id: 'n1',
      ...BOX,
      ring: NodeChrome.Editing,
      handles: false,
      ringColor: '#0099ff',
    });
    expect(m).toMatchObject({ line: 'dashed', handles: 'none', opacity: 0.5 });
  });

  it('an element selection has eight handles, a body, edges and rotate zones', () => {
    const m = selectionMark(
      'sel',
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
      SelectionKind.Element,
      HighlightKind.Element,
    );
    expect(m).toMatchObject({
      handles: 'all',
      body: true,
      edges: true,
      rotate: true,
      line: 'solid',
      offset: -1,
    });
  });

  it('a group selection is dashed and lets the press through its body', () => {
    const m = selectionMark(
      'g',
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
      SelectionKind.Group,
      HighlightKind.Element,
    );
    expect(m).toMatchObject({ line: 'dashed', body: false, handles: 'all' });
  });

  it('a line selection draws no box and no handles', () => {
    const m = selectionMark(
      'l',
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
      SelectionKind.Line,
      HighlightKind.Element,
    );
    expect(m).toMatchObject({
      line: 'none',
      handles: 'none',
      edges: false,
      rotate: false,
    });
  });

  it('pixel sizes reach the engine in device pixels, colours as rgba', () => {
    const json = JSON.parse(marksJson([hoverMark({ id: 'n1', ...BOX })], LOOK));
    expect(json.marks[0]).toMatchObject({ width: 3, offset: 2 });
    expect(json.marks[0].color).toEqual([0, 0.6, 1, 1]);
    expect(json.look).toMatchObject({
      handle: 16,
      border: 2,
      edge: 16,
      reach: 44,
      dash: 8,
      dpr: 2,
    });
    expect(json.marks[0].id).toBeUndefined();
  });

  it('an engine hit is read back as the mark id and its part', () => {
    const marks = [
      hoverMark({ id: 'a', ...BOX }),
      hoverMark({ id: 'b', ...BOX }),
    ];
    expect(markHit(marks, new Float64Array([1, MarkPart.Handle, 2]))).toEqual({
      id: 'b',
      part: MarkPart.Handle,
      n: 2,
    });
    expect(markHit(marks, new Float64Array())).toBeNull();
  });

  it('a mark rect comes back in css pixels', () => {
    expect(markRect(new Float64Array([20, 40, 200, 100]), 2)).toEqual({
      x: 10,
      y: 20,
      w: 100,
      h: 50,
    });
    expect(markRect(new Float64Array(), 2)).toBeNull();
  });
});
