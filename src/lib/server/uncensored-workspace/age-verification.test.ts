import { describe, expect, it } from 'vitest';
import { MANUAL_ADMIN, VerifierSetting, verifierFor, verifyAge, type AgeVerificationStore } from './age-verification';

function memoryStore(): AgeVerificationStore & { rows: Array<{ userId: string; provider: string; method: string }> } {
  const rows: Array<{ userId: string; provider: string; method: string }> = [];
  return {
    rows,
    save: async (row) => {
      rows.push(row);
    },
    isVerified: async (userId) => rows.some((r) => r.userId === userId)
  };
}

describe('age verification port', () => {
  it('no verifier is configured unless the dev manual flag is on in dev', () => {
    expect(verifierFor(VerifierSetting.None)).toBeNull();
    expect(verifierFor(VerifierSetting.DevManual)?.key).toBe(MANUAL_ADMIN.key);
  });

  it('an adult verdict is stored with provider and method only', async () => {
    const store = memoryStore();
    const out = await verifyAge(MANUAL_ADMIN, store, 'u1');
    expect(out).toEqual({ ok: true });
    expect(store.rows).toEqual([{ userId: 'u1', provider: 'manual_admin', method: 'manual_admin' }]);
    expect(await store.isVerified('u1')).toBe(true);
  });

  it('a non-adult verdict stores nothing', async () => {
    const store = memoryStore();
    const minor = { key: 'x', check: async () => ({ adult: false as const }) };
    expect(await verifyAge(minor, store, 'u1')).toEqual({ ok: false, error: 'age_not_verified' });
    expect(store.rows).toEqual([]);
  });
});
