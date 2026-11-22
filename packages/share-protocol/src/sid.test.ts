import { describe, expect, it } from 'vitest';
import { SID_LENGTH, isSid, newSid, sidOfHost } from './sid';

describe('sid', () => {
  it('generates ten lowercase base32 characters', () => {
    for (let i = 0; i < 50; i++) {
      const sid = newSid();

      expect(sid).toHaveLength(SID_LENGTH);
      expect(sid).toMatch(/^[a-z2-7]{10}$/);
    }
  });

  it('draws from the whole alphabet and does not repeat', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(newSid());
    }

    expect(seen.size).toBe(200);
  });

  it('maps random bytes to characters without bias on the top bits', () => {
    expect(newSid(() => new Uint8Array(10).fill(0))).toBe('aaaaaaaaaa');
    expect(newSid(() => new Uint8Array(10).fill(255))).toBe('7777777777');
  });

  it('validates only well formed sids', () => {
    expect(isSid('abcdefghij')).toBe(true);
    expect(isSid('a2b3c4d5e6')).toBe(true);
    expect(isSid('abcdefghi')).toBe(false);
    expect(isSid('abcdefghijk')).toBe(false);
    expect(isSid('ABCDEFGHIJ')).toBe(false);
    expect(isSid('abcdefghi1')).toBe(false);
    expect(isSid('abcdefghi.')).toBe(false);
    expect(isSid('')).toBe(false);
    expect(isSid(undefined)).toBe(false);
  });

  it('reads the sid from the visitor host', () => {
    expect(sidOfHost('abcdefghij.sessions.test', 'sessions.test')).toBe('abcdefghij');
    expect(sidOfHost('abcdefghij.localhost:8787', 'localhost:8787')).toBe('abcdefghij');
    expect(sidOfHost('ABCDEFGHIJ.sessions.test', 'sessions.test')).toBe('abcdefghij');
  });

  it('refuses hosts that are not a sid under the base domain', () => {
    expect(sidOfHost('relay.sessions.test', 'sessions.test')).toBeNull();
    expect(sidOfHost('sessions.test', 'sessions.test')).toBeNull();
    expect(sidOfHost('abcdefghij.evil.com', 'sessions.test')).toBeNull();
    expect(sidOfHost('x.abcdefghij.sessions.test', 'sessions.test')).toBeNull();
    expect(sidOfHost('abcdefghijsessions.test', 'sessions.test')).toBeNull();
    expect(sidOfHost(null, 'sessions.test')).toBeNull();
  });
});
