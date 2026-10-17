import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { actions, load } from '$lib/server/settings/pages/profile';

const USER = { id: 'u-1', email: 'ada@example.com', user_metadata: {} };

function world() {
  return fakeDb({ profiles: [{ id: 'u-1', email: 'ada@example.com', name: 'Ada Lovelace', avatar_url: null }] }, { filter: true });
}

const locals = (db: unknown) => ({ supabase: db, safeGetSession: async () => ({ session: {}, user: USER }) });

describe('settings profile', () => {
  it('shows the name stored on the profile', async () => {
    const data = await load({ locals: locals(world().db) } as never);

    expect(data).toMatchObject({ firstName: 'Ada', lastName: 'Lovelace' });
  });

  it('saves first and last name into profiles.name', async () => {
    const w = world();
    const form = new FormData();
    form.set('firstName', 'Grace');
    form.set('lastName', 'Hopper');

    await actions.updateProfile({ request: new Request('https://feega.app', { method: 'POST', body: form }), locals: locals(w.db) } as never);

    const update = w.calls.find((c) => c.table === 'profiles' && c.op === 'update');
    expect(update?.payload).toEqual({ name: 'Grace Hopper' });
  });
});
