import { describe, expect, it } from 'vitest';
import { NO_PERMISSIONS, questionOf } from './review';

describe('questionOf', () => {
  it('names the plugin and lists what it can do', () => {
    expect(questionOf({ id: 'a.b', name: 'Hello', version: '1.0.0', words: ['See which element you select'] })).toBe('Install Hello 1.0.0? Feega has not reviewed this plugin.\nIt will be able to:\n- See which element you select');
  });

  it('says when nothing is asked', () => {
    expect(questionOf({ id: 'a.b', name: 'Hello', version: '1.0.0', words: [] })).toContain(NO_PERMISSIONS);
  });
});
