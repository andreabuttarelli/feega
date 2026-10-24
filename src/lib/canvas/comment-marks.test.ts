import { describe, expect, it } from 'vitest';
import { frameOfMs, marksFor, msOfFrame } from './comment-marks';
import type { CommentThread } from './comment-threads';

const thread = (id: string, number: number, over: Partial<CommentThread> = {}): CommentThread => ({
  id,
  number,
  nodeId: 'f1',
  authorId: 'u1',
  x: 0,
  y: 0,
  body: id,
  resolved: false,
  timeMs: 1000,
  mentions: [],
  editedAt: null,
  createdAt: '2026-10-24T00:00:00.000Z',
  replies: [],
  ...over
});

describe('timeline comment marks', () => {
  it('converts between milliseconds and frames at the doc fps', () => {
    expect(frameOfMs(1500, 30)).toBe(45);
    expect(msOfFrame(45, 30)).toBe(1500);
  });

  it('marks only the open threads of this frame that carry a time', () => {
    const marks = marksFor(
      [thread('a', 1), thread('b', 2, { timeMs: null }), thread('c', 3, { nodeId: 'f2' }), thread('d', 4, { resolved: true }), thread('e', 5, { timeMs: 2000 })],
      'f1',
      30
    );

    expect(marks).toEqual([
      { id: 'a', number: 1, frame: 30 },
      { id: 'e', number: 5, frame: 60 }
    ]);
  });
});
