import { describe, expect, it } from 'vitest';
import { TourWrite, ensureProfile, markTourSeen, profileFromAuthUser, readTourSeen, recordTermsAcceptance } from '$lib/server/repos/profiles';
import { fakeDb } from '$lib/server/db/fake-db';
import type { User } from '@supabase/supabase-js';

const USER = '11111111-1111-1111-1111-111111111111';

const authUser = (metadata: Record<string, unknown>): User =>
  ({ id: USER, email: 'chi@esempio.it', user_metadata: metadata }) as unknown as User;

const row = {
  id: USER,
  email: 'chi@esempio.it',
  name: 'Chi Esempio',
  avatar_url: 'https://esempio.it/a.png',
  terms_accepted_at: null,
  terms_version: null
};

describe('il profilo si ricava dall utente di auth', () => {
  it('prende il nome da full_name', () => {
    expect(profileFromAuthUser(authUser({ full_name: 'Chi Esempio' })).name).toBe('Chi Esempio');
  });

  it('ripiega su name quando full_name non c è', () => {
    expect(profileFromAuthUser(authUser({ name: 'Chi' })).name).toBe('Chi');
  });

  it('senza nome resta null, non una stringa vuota', () => {
    expect(profileFromAuthUser(authUser({})).name).toBeNull();
  });

  it("l'avatar arriva da avatar_url o da picture", () => {
    expect(profileFromAuthUser(authUser({ picture: 'https://p/1.png' })).avatarUrl).toBe('https://p/1.png');
    expect(profileFromAuthUser(authUser({ avatar_url: 'https://a/1.png' })).avatarUrl).toBe('https://a/1.png');
  });

  it('un utente senza email non produce un profilo: la colonna non lo accetta', () => {
    const anonymous = { id: USER, email: null, user_metadata: {} } as unknown as User;

    expect(() => profileFromAuthUser(anonymous)).toThrow();
  });
});

describe('il profilo nasce al primo accesso', () => {
  it('scrive la riga sull id di auth, che è la stessa persona', async () => {
    const { db, calls } = fakeDb({ profiles: [row] });

    await ensureProfile(db, authUser({ full_name: 'Chi Esempio', picture: 'https://esempio.it/a.png' }));

    const upsert = calls.find((c) => c.op === 'upsert')!;
    expect(upsert.payload).toMatchObject({
      id: USER,
      email: 'chi@esempio.it',
      name: 'Chi Esempio',
      avatar_url: 'https://esempio.it/a.png'
    });
  });

  it('restituisce la forma di dominio, non la riga', async () => {
    const { db } = fakeDb({ profiles: [row] });

    expect(await ensureProfile(db, authUser({ full_name: 'Chi Esempio' }))).toEqual({
      id: USER,
      email: 'chi@esempio.it',
      name: 'Chi Esempio',
      avatarUrl: 'https://esempio.it/a.png',
      termsAcceptedAt: null,
      termsVersion: null
    });
  });
});

describe('l’accettazione dei termini si registra una volta', () => {
  it('scrive la data e la versione sul profilo', async () => {
    const { db, calls } = fakeDb({ profiles: [row] });

    await recordTermsAcceptance(db, USER, '2026-09-30');

    const update = calls.find((c) => c.op === 'update')!;
    expect(update.payload).toMatchObject({ terms_version: '2026-09-30' });
    expect(update.filters).toEqual([['id', USER]]);
  });
});

const MISSING_COLUMN = { code: '42703', message: 'column profiles.onboarding_seen_at does not exist' };
const NOT_IN_CACHE = { code: 'PGRST204', message: "Could not find the 'onboarding_seen_at' column of 'profiles' in the schema cache" };

function answering(result: { data?: unknown; error?: unknown }) {
  const writes: unknown[] = [];
  const outcome = { data: result.data ?? null, error: result.error ?? null };
  const chain = {
    select: () => chain,
    update: (payload: unknown) => {
      writes.push(payload);
      return chain;
    },
    eq: () => chain,
    maybeSingle: async () => outcome,
    then: (resolve: (v: unknown) => unknown) => resolve(outcome)
  };
  return { db: { from: () => chain } as never, writes };
}

describe('il tour si ricorda per persona', () => {
  it('legge quando è stato visto', async () => {
    const { db } = answering({ data: { onboarding_seen_at: '2026-10-12T10:00:00Z' } });
    expect(await readTourSeen(db, USER)).toEqual({ seenAt: '2026-10-12T10:00:00Z' });
  });

  it('senza colonna risponde null invece di fingere un mai visto', async () => {
    expect(await readTourSeen(answering({ error: MISSING_COLUMN }).db, USER)).toBeNull();
    expect(await readTourSeen(answering({ error: NOT_IN_CACHE }).db, USER)).toBeNull();
  });

  it('un altro errore non si nasconde', async () => {
    await expect(readTourSeen(answering({ error: { code: '500', message: 'boom' } }).db, USER)).rejects.toBeTruthy();
  });

  it('segnarlo visto scrive la data', async () => {
    const { db, writes } = answering({});
    expect(await markTourSeen(db, USER)).toBe(TourWrite.Saved);
    expect(writes[0]).toHaveProperty('onboarding_seen_at');
  });

  it('senza colonna segnarlo dice che non è stato salvato', async () => {
    expect(await markTourSeen(answering({ error: NOT_IN_CACHE }).db, USER)).toBe(TourWrite.NoColumn);
  });
});
