import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

const member = (user_id: string, role: string) => ({ org_id: 'org-1', user_id, role, profiles: { email: `${user_id}@x.it`, name: null } });

const { db, calls } = fakeDb(
  { orgs_members: [member('user-1', 'owner'), member('user-2', 'member')], orgs_invites: [], orgs: [{ id: 'org-1', name: 'Acme' }], credit_ledger: [] },
  { filter: true }
);
const mail = vi.fn(async () => true);

vi.mock('$lib/server/api/bearer-page', () => ({ bearerOf: async () => ({ token: 't', db, user: { id: 'user-1', email: 'o@x.it' } }) }));
vi.mock('$lib/server/team/invite-mail', () => ({ inviteMailer: () => mail }));

const { GET, POST } = await import('./+server');

const url = new URL('https://feega.app/api/v1/orgs/org-1/team');
const event = (orgId: string, body?: unknown) =>
  ({ url, params: { orgId }, request: new Request(url, body ? { method: 'POST', body: JSON.stringify(body) } : {}) }) as never;

describe('/api/v1/orgs/[orgId]/team', () => {
  it('GET elenca i membri col ruolo di chi chiede', async () => {
    const res = await GET(event('org-1'));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ role: 'owner', members: [{ userId: 'user-1' }, { userId: 'user-2' }] });
  });

  it("GET di un'org altrui è 404", async () => {
    expect((await GET(event('org-x'))).status).toBe(404);
  });

  it('POST invite crea l invito e manda la mail', async () => {
    const res = await POST(event('org-1', { op: 'invite', email: 'v@x.it', role: 'viewer' }));

    expect(res.status).toBe(200);
    expect(calls.some((c) => c.table === 'orgs_invites' && c.op === 'insert')).toBe(true);
    expect(mail).toHaveBeenCalled();
  });

  it("POST set_role sull'owner è 403", async () => {
    expect((await POST(event('org-1', { op: 'set_role', user_id: 'user-1', role: 'member' }))).status).toBe(403);
  });

  it('un op sconosciuto è 400', async () => {
    expect((await POST(event('org-1', { op: 'nope' }))).status).toBe(400);
  });
});
