import { describe, expect, it } from 'vitest';
import { conflictTitle, shownValue, unsavedLine } from './folder-sync';

describe('folder sync wording', () => {
  it('names a field conflict by node and field', () => {
    expect(conflictTitle({ collection: 'nodes', id: 'abcdef12-0000', field: 'data.text', base: null, ours: 1, theirs: 2 }, { 'abcdef12-0000': 'Hero title' })).toBe('Hero title · text');
  });

  it('names a deleted-versus-edited conflict', () => {
    expect(conflictTitle({ collection: 'nodes', id: 'abcdef12-0000', field: '*', base: {}, ours: null, theirs: {} }, {})).toBe('abcdef12 · deleted on one side');
  });

  it('shows a removed value and cuts long ones', () => {
    expect(shownValue(null)).toBe('(removed)');
    expect(shownValue('x'.repeat(100))).toBe(`"${'x'.repeat(57)}…`);
    expect(shownValue({ a: 1 })).toBe('{"a":1}');
  });

  it('says since when the folder is not saved', () => {
    expect(unsavedLine('2026-11-19T09:05:00.000Z', 'UTC')).toBe('Not saved to .feega/ since 09:05');
  });
});
