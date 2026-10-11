import { describe, it, expect } from 'vitest';
import { POST } from './+server';

const NOT_IN_CACHE = { code: 'PGRST204', message: "Could not find the 'onboarding_seen_at' column of 'profiles' in the schema cache" };

function dbAnswering(error: unknown) {
  const writes: { payload: unknown; id: unknown }[] = [];
  const db = {
    from: () => ({
      update: (payload: unknown) => ({
        eq: async (_col: string, id: unknown) => {
          writes.push({ payload, id });
          return { data: null, error };
        }
      })
    })
  };
  return { db, writes };
}

async function call(user: { id: string } | null, db: unknown) {
  const res = await (POST as (event: unknown) => Promise<Response>)({ locals: { safeGetSession: async () => ({ user }), db: async () => db } });
  return { res, body: await res.json() };
}

describe('POST /api/onboarding-tour', () => {
  it('segna il tour come visto sul profilo di chi è in sessione', async () => {
    const { db, writes } = dbAnswering(null);
    const { res, body } = await call({ id: 'u1' }, db);

    expect(res.status).toBe(200);
    expect(body).toEqual({ saved: true });
    expect(writes[0].id).toBe('u1');
    expect(writes[0].payload).toHaveProperty('onboarding_seen_at');
  });

  it('senza colonna lo dice, così il browser se lo ricorda da solo', async () => {
    const { res, body } = await call({ id: 'u1' }, dbAnswering(NOT_IN_CACHE).db);

    expect(res.status).toBe(200);
    expect(body).toEqual({ saved: false });
  });

  it('rifiuta senza sessione', async () => {
    const { res } = await call(null, dbAnswering(null).db);
    expect(res.status).toBe(401);
  });
});
