import { describe, expect, it } from 'vitest';
import { BatchState, SelectBody, batchOf, selectView } from './node-view';
import type { ListNode } from './list-node';
import type { SelectOutput } from './select-outputs';

const list = (itemKind: 'image' | 'text', items: ListNode['items']): ListNode => ({ id: 'l', itemKind, items });
const output = (over: Partial<SelectOutput>): SelectOutput => ({ handle: 'out:images', label: 'Images', port: 'images', field: 'images', custom: null, incompatible: false, ...over });

describe('selectView — what the select card shows of its connected list', () => {
  it('says to connect a list when there is none, and that it is empty when it has no item', () => {
    expect(selectView(1, null, [], {}, false).body).toBe(SelectBody.Unconnected);
    expect(selectView(1, list('text', []), [], {}, false)).toMatchObject({ body: SelectBody.Empty, total: 0 });
  });

  it('shows the item at the index: its photo, or its text, or a missing-photo placeholder', () => {
    const items = [{ url: 'a.jpg' }, { label: 'b' }];

    expect(selectView(1, list('image', items), [], {}, false)).toMatchObject({ body: SelectBody.Photo, url: 'a.jpg' });
    expect(selectView(2, list('image', items), [], {}, false).body).toBe(SelectBody.PhotoMissing);
    expect(selectView(2, list('text', items), [], {}, false)).toMatchObject({ body: SelectBody.Text, text: 'b' });
  });

  it('summarises each output: a file count, trimmed text, a dash, or that it is not available', () => {
    const values = { 'out:images': { port: 'images' as const, mediaUrls: ['x', 'y'], text: null }, 'out:text': { port: 'text' as const, mediaUrls: [], text: 'z'.repeat(70) } };
    const rows = selectView(1, null, [output({}), output({ handle: 'out:text', port: 'text', label: 'Text' }), output({ handle: 'out:x', incompatible: true })], values, true).rows;

    expect(rows.map((r) => r.value)).toEqual(['2 files', `${'z'.repeat(60)}…`, 'Not available']);
    expect(rows[0].thumb).toBe('x');
    expect(rows[2].flagged).toBe(true);
  });
});

describe('batchOf', () => {
  it('reads like the studio card: approved in bold, then done of total, running and failed only when there are some', () => {
    expect(batchOf({ approved: 3, done: 5, total: 8, running: 0, failed: 0, thumbs: [] })).toMatchObject({ state: BatchState.Card, approved: '3', rest: ' approved · 5/8 done' });
    expect(batchOf({ approved: 0, done: 1, total: 8, running: 2, failed: 1, thumbs: [] }).rest).toBe(' approved · 1/8 done · 2 running · 1 failed');
  });
});
