import { describe, expect, it } from 'vitest';
import { applyEdits } from './edits';

describe('applyEdits', () => {
  it('replaces each find once, in order', () => {
    expect(applyEdits('a b a', [{ find: 'a', replace: 'c' }, { find: 'b', replace: 'd' }])).toEqual({ ok: true, text: 'c d a' });
  });

  it('refuses a find that is absent', () => {
    expect(applyEdits('abc', [{ find: 'z', replace: 'y' }])).toEqual({ ok: false, problem: 'edit 0: "z" not found' });
  });
});
