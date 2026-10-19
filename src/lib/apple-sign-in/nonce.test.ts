import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { appleNonce } from './nonce';

describe('Apple nonce', () => {
  it('Apple gets the SHA-256 hex of the nonce Supabase gets', async () => {
    const { raw, hashed } = await appleNonce();
    expect(hashed).toBe(createHash('sha256').update(raw).digest('hex'));
  });

  it('every sign-in gets a fresh nonce', async () => {
    const [a, b] = await Promise.all([appleNonce(), appleNonce()]);
    expect(a.raw).not.toBe(b.raw);
    expect(a.raw.length).toBeGreaterThanOrEqual(32);
  });
});
