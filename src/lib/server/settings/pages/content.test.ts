import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { actions, load } from './content';

const ORG = 'org-1';
const USER = 'user-1';

const shell = { org: { id: ORG, name: 'Acme', slug: 'acme', role: 'owner' }, project: null, brand: null };

function event(form: Record<string, string> = {}) {
  const fake = fakeDb(
    {
      orgs: [{ id: ORG, stripe_subscription_id: 'sub_1' }],
      orgs_members: [{ org_id: ORG, user_id: USER, role: 'owner' }],
      org_uncensored_optins: [],
      influencers: [{ id: 'i-1', org_id: ORG, name: 'Mia', age: 30, adult_persona_at: null, source: 'generated', deleted_at: null }]
    },
    { filter: true }
  );
  Object.assign(fake.db, { auth: { getUser: async () => ({ data: { user: { id: USER } } }) } });
  const body = new FormData();
  Object.entries(form).forEach(([key, value]) => body.set(key, value));
  return {
    fake,
    event: {
      params: {},
      parent: async () => shell,
      locals: { supabase: fake.db },
      request: { formData: async () => body }
    } as never
  };
}

describe('the content settings page, with no project in the path', () => {
  it('loads the access and the AI personas of the workspace', async () => {
    const { event: e } = event();

    const data = (await load(e)) as { access: { entitled: boolean }; personas: { id: string }[] };

    expect(data.access.entitled).toBe(true);
    expect(data.personas.map((p) => p.id)).toEqual(['i-1']);
  });

  it('turns the uncensored mode on for the workspace of the shell', async () => {
    const { event: e, fake } = event({ attestAdult: 'on', acceptPolicy: 'on', acknowledgeScreening: 'on' });

    await (actions.enable as (e: never) => Promise<unknown>)(e);

    expect(fake.calls.some((c) => c.table === 'org_uncensored_optins' && (c.op === 'insert' || c.op === 'upsert'))).toBe(true);
  });
});
