import { describe, expect, it } from 'vitest';
import { hasUnseenMention, latestActivity, insertMention, mentionQuery, mentionedIds, type Teammate } from './comment-mentions';
import type { CommentThread } from './comment-threads';

const team: Teammate[] = [
  { id: 'u1', name: 'Ada' },
  { id: 'u2', name: 'Bruno' },
  { id: 'u3', name: 'Ada Lovelace' }
];

const thread = (over: Partial<CommentThread> = {}): CommentThread => ({
  id: 't1',
  number: 1,
  nodeId: null,
  authorId: 'u2',
  x: 0,
  y: 0,
  body: 'hi',
  resolved: false,
  timeMs: null,
  mentions: [],
  editedAt: null,
  createdAt: '2026-10-24T10:00:00.000Z',
  replies: [],
  ...over
});

describe('mentions in a comment draft', () => {
  it('asks for suggestions while the last word starts with @', () => {
    expect(mentionQuery('hello @br')).toBe('br');
    expect(mentionQuery('hello @')).toBe('');
    expect(mentionQuery('hello @bruno ')).toBeNull();
    expect(mentionQuery('no mention')).toBeNull();
  });

  it('replaces the half-typed word with the picked name', () => {
    expect(insertMention('hello @br', 'Bruno')).toBe('hello @Bruno ');
  });

  it('collects the teammates named in the body, longest name first, without duplicates', () => {
    expect(mentionedIds('@Ada Lovelace and @Bruno, also @Bruno', team)).toEqual(['u3', 'u2']);
    expect(mentionedIds('@Adam is not Ada', team)).toEqual([]);
  });
});

describe('the notification dot', () => {
  it('lights for a mention of me by someone else after I last looked', () => {
    expect(hasUnseenMention([thread({ mentions: ['me'] })], 'me', '2026-10-24T09:00:00.000Z')).toBe(true);
  });

  it('sees mentions inside replies', () => {
    const reply = { id: 'r1', authorId: 'u2', body: '@me', mentions: ['me'], editedAt: null, createdAt: '2026-10-24T11:00:00.000Z' };

    expect(hasUnseenMention([thread({ replies: [reply] })], 'me', '2026-10-24T10:30:00.000Z')).toBe(true);
  });

  it('stays dark for old mentions, my own, and mentions of others', () => {
    const seen = '2026-10-24T10:00:00.000Z';

    expect(hasUnseenMention([thread({ mentions: ['me'] })], 'me', seen)).toBe(false);
    expect(hasUnseenMention([thread({ mentions: ['me'], authorId: 'me', createdAt: '2026-10-24T12:00:00.000Z' })], 'me', seen)).toBe(false);
    expect(hasUnseenMention([thread({ mentions: ['u1'], createdAt: '2026-10-24T12:00:00.000Z' })], 'me', seen)).toBe(false);
  });

  it('lights for any mention when the panel was never opened', () => {
    expect(hasUnseenMention([thread({ mentions: ['me'] })], 'me', null)).toBe(true);
  });
});

describe('the last-seen mark', () => {
  it('is the newest moment among threads and replies', () => {
    const reply = { id: 'r1', authorId: 'u2', body: 'x', mentions: [], editedAt: null, createdAt: '2026-10-24T11:00:00.000Z' };

    expect(latestActivity([thread(), thread({ replies: [reply] })])).toBe('2026-10-24T11:00:00.000Z');
    expect(latestActivity([])).toBeNull();
  });
});
