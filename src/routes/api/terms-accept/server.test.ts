import { describe, it, expect, vi, beforeEach } from 'vitest';

const recordTermsAcceptance = vi.fn();

vi.mock('$lib/server/repos/profiles', () => ({
  recordTermsAcceptance: (...args: unknown[]) => recordTermsAcceptance(...args)
}));

import { POST } from './+server';
import { CURRENT_TERMS_VERSION } from '$lib/legal-links';

function call(locals: { safeGetSession: () => Promise<{ user: { id: string } | null }>; db: () => Promise<unknown> }) {
  return (POST as (event: unknown) => Promise<Response>)({ locals }).then(async (res) => ({
    res,
    body: await res.json()
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/terms-accept', () => {
  it('registra la versione corrente per l’utente di sessione', async () => {
    const db = {};
    const { res, body } = await call({
      safeGetSession: async () => ({ user: { id: 'u1' } }),
      db: async () => db
    });

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(recordTermsAcceptance).toHaveBeenCalledWith(db, 'u1', CURRENT_TERMS_VERSION);
  });

  it('rifiuta senza sessione', async () => {
    const { res } = await call({ safeGetSession: async () => ({ user: null }), db: async () => ({}) });

    expect(res.status).toBe(401);
    expect(recordTermsAcceptance).not.toHaveBeenCalled();
  });
});
