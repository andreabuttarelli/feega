import { describe, expect, it } from 'vitest';
import { isOwnEcho } from './node-save';
import { FRAME_GAP, besideBox, copiedNodes, defaultFrameBox, drawnFrameTile, drawnTile, pendingOutput, pendingPicture, placedFrame, settle } from './optimistic-insert';
import { DrawTool } from '$lib/motion/draw-tool';
import { CANVAS_INK, CanvasTheme, drawnFrame } from '$lib/motion/draw-create';
import { drawFrame, prepare } from '@feega/motion-core/motion/gpu-full/display-list';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';

const doc = { width: 1080, height: 1350 };
const placed = placedFrame({ id: 'f1', canvasId: 'c', projectId: 'p', name: 'Checker', at: { x: 10, y: 20 }, doc });
const tile = (id: string, version = 0) => ({ id, version });

describe('a frame placed before the server answers', () => {
  it('already points at its first revision, as the saved row will', () => {
    expect(placed.data.docHeadRevision).toBe(1);
    expect(placed).toMatchObject({ id: 'f1', type: 'motion', displayName: 'Checker', position: { x: 10, y: 20 } });
  });

  it('is the same tile its realtime insert describes, so the echo refetches nothing', () => {
    const row = { id: 'f1', x: 10, y: 20, display_name: 'Checker', data: placed.data, deleted_at: null };
    expect(isOwnEcho({ table: 'nodes', eventType: 'INSERT', new: row }, [{ id: 'f1', x: 10, y: 20, displayName: 'Checker', data: placed.data }])).toBe(true);
  });

  it('takes the saved row in its place, once', () => {
    expect(settle([tile('a'), tile('f1')], 'f1', tile('f1', 1))).toEqual([tile('a'), tile('f1', 1)]);
  });

  it('is rolled back when the save fails', () => {
    expect(settle([tile('a'), tile('f1')], 'f1', null)).toEqual([tile('a')]);
  });

  it('does not come back if it was removed while saving', () => {
    expect(settle([tile('a')], 'f1', tile('f1', 1))).toEqual([tile('a')]);
  });
});

describe('a generated output dropped on the canvas', () => {
  it('shows centred on the drop while it saves', () => {
    expect(pendingOutput('o1', { x: 500, y: 500 })).toMatchObject({ id: 'o1', type: 'pending_frame', position: { x: 340, y: 340 } });
  });
});

describe('a picture dragged out of a feed and dropped on the canvas', () => {
  it('shows at the size the image node will have, centred on the drop, while the copy runs', () => {
    expect(pendingPicture('p1', { x: 500, y: 400 }, { w: 288, h: 360 })).toMatchObject({
      id: 'p1',
      type: 'pending_frame',
      position: { x: 356, y: 220 },
      size: { width: 288, height: 360 }
    });
  });
});

describe('a shape drawn on the canvas before the server answers', () => {
  it('stands where the saved element will, as a chromeless element showing what was drawn', () => {
    const drawn = drawnTile('e1', { tool: DrawTool.Rectangle, box: { left: 120, top: 40, width: 300, height: 100 } });

    expect(drawn?.node).toMatchObject({ id: 'e1', type: 'element', position: { x: 120, y: 40 }, size: { width: 300, height: 100 }, data: { docHeadRevision: 1 } });
    expect(drawn?.look).toMatch(/^data:image\/svg\+xml,/);
  });

  it('a line stands as the stroke that was drawn', () => {
    const look = decodeURIComponent(drawnTile('l1', { tool: DrawTool.Line, from: { x: 0, y: 0 }, to: { x: 200, y: 80 } })?.look ?? '');

    expect(look).toContain('<path');
  });

  it('a text stands as its words in the ink of the canvas, not as a grey box', () => {
    const look = decodeURIComponent(drawnTile('t1', { tool: DrawTool.Text, box: { left: 0, top: 0, width: 300, height: 100 }, theme: CanvasTheme.Dark })?.look ?? '');

    expect(look).toContain('>Text</text>');
    expect(look).toContain(`fill="${CANVAS_INK[CanvasTheme.Dark]}"`);
    expect(look).not.toContain('<rect');
  });

  it('carries the doc the gpu draws its fill from, on the gesture, before any network', () => {
    const drawn = drawnTile('e1', { tool: DrawTool.Rectangle, box: { left: 120, top: 40, width: 300, height: 100 } });

    expect(drawFrame(prepare(drawn!.doc, FEEGA_TOKENS), 0).items.map((i) => i.clip)).toContain('e1');
  });

  it('places a pen path at the box of its points', () => {
    expect(drawnTile('e2', { tool: DrawTool.Pen, path: 'M 10 20 L 110 20 L 110 70' })?.node).toMatchObject({ position: { x: 10, y: 20 }, size: { width: 100, height: 50 } });
  });
});

describe('a frame drawn on the canvas before the server answers', () => {
  it('stands on the dragged box, as a frame with its bar', () => {
    expect(drawnFrameTile('f9', { left: 100, top: 50, width: 400, height: 300 }).node).toMatchObject({ id: 'f9', type: 'motion', position: { x: 100, y: 50 }, size: { width: 400 }, data: { docHeadRevision: 1 } });
  });

  it('carries the doc the server stores for it, so its body is drawn before the save lands', () => {
    const box = { left: 100, top: 50, width: 400, height: 300 };

    expect(drawnFrameTile('f9', box).doc).toEqual(drawnFrame(box));
  });
});

describe('where a clicked frame lands and how big it is', () => {
  const at = { x: 500, y: 300 };

  it('is 100 by 100 the first time, centred on the click', () => {
    expect(defaultFrameBox(at, null)).toEqual({ left: 450, top: 250, width: 100, height: 100 });
  });

  it('reuses the size of the last frame', () => {
    expect(defaultFrameBox(at, { width: 400, height: 200 })).toEqual({ left: 300, top: 200, width: 400, height: 200 });
  });

  it('the plus beside a frame makes a blank one of the same size to its right', () => {
    expect(besideBox({ x: 100, y: 50, w: 400, h: 300 })).toEqual({ left: 100 + 400 + FRAME_GAP, top: 50, width: 400, height: 300 });
  });
});

describe('a duplicate before the server answers', () => {
  it('stands where the server writes each copy, under the id it will have', () => {
    const plan = { nodes: [{ id: 'c1', sourceIndex: 0, type: 'motion', data: { docHeadRevision: 1 }, x: 42, y: 52, width: 400, height: 300 }, { id: 'c2', sourceIndex: 1, type: 'text', data: { prompt: 'p' }, x: 0, y: 0 }], edges: [] };

    expect(copiedNodes(plan)).toEqual([
      expect.objectContaining({ id: 'c1', type: 'motion', position: { x: 42, y: 52, z: 0 }, size: { width: 400, height: 300 }, data: { docHeadRevision: 1 }, version: 0 }),
      expect.objectContaining({ id: 'c2', type: 'text', size: { width: null, height: null } })
    ]);
  });
});
