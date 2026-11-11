import { describe, expect, it, vi } from 'vitest';
import { insertThenClose } from './insert-flow';
import type { Inserted } from './library';

const placed = { ok: true, doc: {}, clipId: 'c' } as unknown as Inserted;
const refused = { ok: false, error: 'a video holds at most 120 fields' } as Inserted;

describe('insertThenClose', () => {
  it('reads the document before the dialog closes, so a closed dialog cannot break the insert', () => {
    let open = true;
    const edit = vi.fn();
    insertThenClose({
      place: () => {
        if (!open) {
          throw new Error('dialog already unmounted');
        }
        return placed;
      },
      edit,
      close: () => (open = false)
    });
    expect(edit).toHaveBeenCalledWith(placed);
  });

  it('reports a refused insert through the edit and still closes', () => {
    const close = vi.fn();
    const edit = vi.fn();
    insertThenClose({ place: () => refused, edit, close });
    expect(edit).toHaveBeenCalledWith(refused);
    expect(close).toHaveBeenCalled();
  });

  it('applies the edit before closing', () => {
    const order: string[] = [];
    insertThenClose({ place: () => placed, edit: () => order.push('edit'), close: () => order.push('close') });
    expect(order).toEqual(['edit', 'close']);
  });
});
