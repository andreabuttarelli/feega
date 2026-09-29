import { describe, expect, it } from 'vitest';
import { nextFollow } from './chat-follow';

describe('nextFollow', () => {
  it('stops following when the user scrolls up to read', () => {
    expect(nextFollow('following', { kind: 'scrolled', atBottom: false })).toBe('reading');
  });

  it('resumes following when the user scrolls back to the bottom', () => {
    expect(nextFollow('reading', { kind: 'scrolled', atBottom: true })).toBe('following');
  });

  it('keeps the reader where they are while tokens stream in', () => {
    expect(nextFollow('reading', { kind: 'grew' })).toBe('reading');
    expect(nextFollow('following', { kind: 'grew' })).toBe('following');
  });

  it('follows again after the user sends or jumps to the latest', () => {
    expect(nextFollow('reading', { kind: 'sent' })).toBe('following');
    expect(nextFollow('reading', { kind: 'jumped' })).toBe('following');
  });
});
