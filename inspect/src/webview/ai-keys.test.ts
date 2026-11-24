import { describe, expect, it } from 'vitest';
import { sendsOnKey } from './ai-keys';

const key = (over: Partial<Parameters<typeof sendsOnKey>[0]>) => ({ key: 'Enter', shiftKey: false, isComposing: false, ...over });

describe('sending from the keyboard', () => {
  it('Enter sends', () => {
    expect(sendsOnKey(key({}))).toBe(true);
  });

  it('Shift+Enter adds a line instead', () => {
    expect(sendsOnKey(key({ shiftKey: true }))).toBe(false);
  });

  it('Enter that confirms an IME composition does not send', () => {
    expect(sendsOnKey(key({ isComposing: true }))).toBe(false);
  });

  it('other keys do not send', () => {
    expect(sendsOnKey(key({ key: 'a' }))).toBe(false);
  });
});
