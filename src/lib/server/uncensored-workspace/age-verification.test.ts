import { describe, expect, it } from 'vitest';
import { MANUAL_ADMIN, VerifierSetting, recordAdult, verifierFor, verifyAge, type AgeRow, type AgeVerificationStore } from './age-verification';

function memoryStore(): AgeVerificationStore & { rows: AgeRow[] } {
  const rows: AgeRow[] = [];
  return {
    rows,
    save: async (row) => {
      if (row.sessionId && rows.some((r) => r.sessionId === row.sessionId)) {
        return;
      }
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

  it('an instant adult verdict is stored with provider and method only', async () => {
    const store = memoryStore();
    const out = await verifyAge(MANUAL_ADMIN, store, 'u1', 'https://back');
    expect(out).toEqual({ ok: true });
    expect(store.rows).toEqual([{ userId: 'u1', provider: 'manual_admin', method: 'manual_admin', sessionId: null }]);
    expect(await store.isVerified('u1')).toBe(true);
  });

  it('a hosted verifier sends the user away and stores nothing yet', async () => {
    const store = memoryStore();
    const hosted = { key: 'x', start: async () => ({ redirect: 'https://verify.example/s' }) };
    expect(await verifyAge(hosted, store, 'u1', 'https://back')).toEqual({ ok: false, redirect: 'https://verify.example/s' });
    expect(store.rows).toEqual([]);
  });

  it('the same provider session recorded twice keeps one row', async () => {
    const store = memoryStore();
    await recordAdult(store, { provider: 'didit', userId: 'u1', sessionId: 's1' });
    await recordAdult(store, { provider: 'didit', userId: 'u1', sessionId: 's1' });
    expect(store.rows).toEqual([{ userId: 'u1', provider: 'didit', method: 'age_check', sessionId: 's1' }]);
  });
});
