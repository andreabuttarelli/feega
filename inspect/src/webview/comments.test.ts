import { describe, expect, it } from 'vitest';
import type { CloudComment, CloudRevisions } from '../host/cloud-api';
import type { Pick } from '../messages';
import { PIN_SLOT_PREFIX, draftOf, pinIdOf, pinSlot, pinsOf, reviewLine, sourceOfComment, threadsOf, verdictLines } from './comments';

const comment = (over: Partial<CloudComment>): CloudComment => ({ id: 'c1', sessionId: 's1', authorId: 'u1', authorName: 'Ada', body: 'Tighter', selector: 'div.card', sourceFile: 'src/Card.svelte', sourceLine: 4, sourceCol: 2, parentId: null, createdAt: '2026-11-21T10:00:00Z', resolvedAt: null, resolvedBy: null, ...over });

describe('comment threads', () => {
  it('groups replies under their comment, oldest first', () => {
    const all = [comment({ id: 'r2', parentId: 'c1', createdAt: '2026-11-21T10:05:00Z' }), comment({ id: 'c1' }), comment({ id: 'r1', parentId: 'c1', createdAt: '2026-11-21T10:01:00Z' })];

    const [thread] = threadsOf(all, false);

    expect(thread.root.id).toBe('c1');
    expect(thread.replies.map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('hides resolved threads unless asked', () => {
    const all = [comment({ id: 'a' }), comment({ id: 'b', resolvedAt: '2026-11-21T11:00:00Z' })];

    expect(threadsOf(all, false).map((t) => t.root.id)).toEqual(['a']);
    expect(threadsOf(all, true).map((t) => t.root.id)).toEqual(['a', 'b']);
  });

  it('orders threads by creation time', () => {
    const all = [comment({ id: 'late', createdAt: '2026-11-21T12:00:00Z' }), comment({ id: 'early', createdAt: '2026-11-21T08:00:00Z' })];

    expect(threadsOf(all, false).map((t) => t.root.id)).toEqual(['early', 'late']);
  });

  it('drops replies whose comment is not in the list', () => {
    expect(threadsOf([comment({ id: 'orphan', parentId: 'gone' })], true)).toEqual([]);
  });
});

describe('comment pins', () => {
  it('pins only open threads, numbered in order', () => {
    const threads = threadsOf([comment({ id: 'a' }), comment({ id: 'b', resolvedAt: 'x' }), comment({ id: 'c', createdAt: '2026-11-21T11:00:00Z', sourceLine: 9 })], true);

    expect(pinsOf(threads)).toEqual([
      { id: 'a', number: 1, source: { file: 'src/Card.svelte', line: 4, col: 2 }, stack: 0, replies: 0 },
      { id: 'c', number: 2, source: { file: 'src/Card.svelte', line: 9, col: 2 }, stack: 0, replies: 0 }
    ]);
  });

  it('stacks pins that sit on the same element', () => {
    const threads = threadsOf([comment({ id: 'a' }), comment({ id: 'b', createdAt: '2026-11-21T11:00:00Z' })], false);

    expect(pinsOf(threads).map((p) => p.stack)).toEqual([0, 1]);
  });

  it('counts replies on the pin', () => {
    const threads = threadsOf([comment({ id: 'a' }), comment({ id: 'r', parentId: 'a' })], false);

    expect(pinsOf(threads)[0].replies).toBe(1);
  });

  it('names the page slot after the comment and reads it back', () => {
    expect(pinSlot('c1')).toBe(`${PIN_SLOT_PREFIX}c1`);
    expect(pinIdOf(pinSlot('c1'))).toBe('c1');
    expect(pinIdOf('selected')).toBeNull();
  });
});

describe('comment drafts', () => {
  const pick = { source: { file: 'src/Hero.tsx', line: 12, col: 5 }, tag: 'button', classes: 'btn  primary ' } as Pick;

  it('writes the element, selector and source of the selection', () => {
    expect(draftOf(pick, '  Make it bigger ')).toEqual({ body: 'Make it bigger', selector: 'button.btn.primary', sourceFile: 'src/Hero.tsx', sourceLine: 12, sourceCol: 5 });
  });

  it('is empty for blank text', () => {
    expect(draftOf(pick, '   ')).toBeNull();
  });

  it('a reply carries its comment id and the comment source', () => {
    const root = comment({ id: 'c1' });

    expect(draftOf(null, 'Agreed', root)).toEqual({ body: 'Agreed', selector: 'div.card', sourceFile: 'src/Card.svelte', sourceLine: 4, sourceCol: 2, parentId: 'c1' });
  });

  it('turns a comment back into a source', () => {
    expect(sourceOfComment(comment({}))).toEqual({ file: 'src/Card.svelte', line: 4, col: 2 });
  });
});

describe('review lines', () => {
  const round = (verdicts: CloudRevisions['revisions'][number]['verdicts']): CloudRevisions => ({ status: 'changes_requested', revisions: [{ id: 'r1', sessionId: 's1', number: 2, authorId: 'h', summary: 'Two', changes: [], createdAt: '2026-11-21T10:00:00Z', status: 'changes_requested', verdicts }] });

  it('says no round was published yet', () => {
    expect(reviewLine({ status: 'open', revisions: [] })).toBe('No round published yet');
  });

  it('names the latest round and its status', () => {
    expect(reviewLine(round([]))).toBe('Round 2: Changes requested');
  });

  it('lists who decided, with the note', () => {
    expect(verdictLines(round([{ reviewerId: 'u', reviewerName: 'Vera', verdict: 'changes_requested', note: 'Tighter', decidedAt: '2026-11-21T10:30:00Z' }]))).toEqual(['Vera: Changes requested - Tighter']);
  });
});
