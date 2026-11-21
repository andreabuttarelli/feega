import { describe, expect, it } from 'vitest';
import { VISITOR_HEADER, canEdit, decodeVisitor, encodeVisitor, withVisitor } from './visitor';

const visitor = { userId: 'u1', name: 'Ada', role: 'editor' as const };

describe('visitor header', () => {
  it('round-trips a visitor', () => {
    expect(decodeVisitor(encodeVisitor(visitor))).toEqual(visitor);
  });

  it('keeps the header value ascii so any name travels', () => {
    const encoded = encodeVisitor({ ...visitor, name: 'Zoë 🙂 山田' });

    expect(encoded).toMatch(/^[\x20-\x7e]*$/);
    expect(decodeVisitor(encoded)?.name).toBe('Zoë 🙂 山田');
  });

  it('rejects garbage and wrong shapes', () => {
    expect(decodeVisitor(undefined)).toBeNull();
    expect(decodeVisitor('')).toBeNull();
    expect(decodeVisitor('not json')).toBeNull();
    expect(decodeVisitor('{"userId":"u","name":"n","role":"host"}')).toBeNull();
    expect(decodeVisitor('{"userId":"","name":"n","role":"viewer"}')).toBeNull();
    expect(decodeVisitor('{"userId":"u","role":"viewer"}')).toBeNull();
  });

  it('only editors can edit', () => {
    expect(canEdit('editor')).toBe(true);
    expect(canEdit('viewer')).toBe(false);
  });

  it('replaces any header a visitor sent with the verified one', () => {
    const spoofed = { [VISITOR_HEADER]: encodeVisitor({ userId: 'x', name: 'Mallory', role: 'editor' }), 'X-Feega-Visitor': 'again', accept: '*/*' };

    const headers = withVisitor(spoofed, { userId: 'u2', name: 'Bo', role: 'viewer' });

    expect(decodeVisitor(headers[VISITOR_HEADER])).toEqual({ userId: 'u2', name: 'Bo', role: 'viewer' });
    expect(Object.keys(headers).filter((k) => k.toLowerCase() === VISITOR_HEADER)).toHaveLength(1);
    expect(headers.accept).toBe('*/*');
  });
});
