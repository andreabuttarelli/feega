import { describe, expect, it } from 'vitest';
import { isOwnEcho } from './node-save';
import { drawnFrameTile, drawnTile, pendingOutput, placedFrame, settle } from './optimistic-insert';
import { DrawTool } from '$lib/motion/draw-tool';

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

describe('a shape drawn on the canvas before the server answers', () => {
  it('stands where the saved element will, as a chromeless element showing what was drawn', () => {
    const drawn = drawnTile('e1', { tool: DrawTool.Rectangle, box: { left: 120, top: 40, width: 300, height: 100 } });

    expect(drawn?.node).toMatchObject({ id: 'e1', type: 'motion', position: { x: 120, y: 40 }, size: { width: 300, height: 100 }, data: { kind: 'element', docHeadRevision: 1 } });
    expect(drawn?.look).toMatch(/^data:image\/svg\+xml,/);
  });

  it('places a pen path at the box of its points', () => {
    expect(drawnTile('e2', { tool: DrawTool.Pen, path: 'M 10 20 L 110 20 L 110 70' })?.node).toMatchObject({ position: { x: 10, y: 20 }, size: { width: 100, height: 50 } });
  });
});

describe('a frame drawn on the canvas before the server answers', () => {
  it('stands on the dragged box, as a frame with its bar', () => {
    expect(drawnFrameTile('f9', { left: 100, top: 50, width: 400, height: 300 })).toMatchObject({ id: 'f9', type: 'motion', position: { x: 100, y: 50 }, size: { width: 400 }, data: { docHeadRevision: 1 } });
  });
});
