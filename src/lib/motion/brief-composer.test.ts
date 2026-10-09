import { describe, expect, it } from 'vitest';
import { ComposerKey, composerKey, rotateTemplates } from './brief-composer';

const key = (k: string, shiftKey = false, isComposing = false) => ({ key: k, shiftKey, isComposing });

describe('the brief composer reads keys like a chat', () => {
  it('Enter submits', () => {
    expect(composerKey(key('Enter'))).toBe(ComposerKey.Submit);
  });

  it('Shift+Enter writes a newline', () => {
    expect(composerKey(key('Enter', true))).toBe(ComposerKey.Type);
  });

  it('Enter while an IME is composing does not submit', () => {
    expect(composerKey(key('Enter', false, true))).toBe(ComposerKey.Type);
  });

  it('any other key types', () => {
    expect(composerKey(key('a'))).toBe(ComposerKey.Type);
  });
});

describe('example prompts rotate', () => {
  const all = ['a', 'b', 'c', 'd', 'e'];

  it('shows a window starting at the turn', () => {
    expect(rotateTemplates(all, 0, 3)).toEqual(['a', 'b', 'c']);
    expect(rotateTemplates(all, 4, 3)).toEqual(['e', 'a', 'b']);
  });

  it('never shows more than exist', () => {
    expect(rotateTemplates(['a', 'b'], 1, 3)).toEqual(['b', 'a']);
  });
});
