import { describe, expect, it } from 'vitest';
import { isOwnEcho } from './node-save';
import { pendingOutput, placedFrame, settle } from './optimistic-insert';

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
