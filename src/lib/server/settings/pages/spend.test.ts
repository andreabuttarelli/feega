import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { load, actions } from './spend';

const shell = (role: string) => ({ org: { id: 'org-1', name: 'Acme', slug: 'acme', role } });

const formOf = (entries: [string, string][]) => {
  const form = new FormData();
  entries.forEach(([key, value]) => form.append(key, value));
  return form;
};

function event(role: string, entries: [string, string][] = []) {
  const fake = fakeDb(
    {
      orgs_members: [{ org_id: 'org-1', user_id: 'user-1', role }],
      projects: [{ id: 'p-1', org_id: 'org-1', brand_id: null, archived_at: null }],
      org_spend_caps: [
        { org_id: 'org-1', scope: 'org_member', project_id: null, cap_usd: 20, reset: 'monthly' },
        { org_id: 'org-1', scope: 'project_total', project_id: 'p-1', cap_usd: 100, reset: 'none' },
        { org_id: 'org-1', scope: 'project_total', project_id: 'p-2', cap_usd: 1, reset: 'none' }
      ]
    },
    { filter: true }
  );
  Object.assign(fake.db, { auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) } });
  return {
    fake,
    event: {
      params: { projectId: 'p-1' },
      parent: async () => shell(role),
      locals: { supabase: fake.db },
      request: { formData: async () => formOf(entries) }
    } as never
  };
}

const save = (e: never) => (actions.saveCap as (e: never) => Promise<unknown>)(e);

describe('the Billing limits settings page', () => {
  it('shows the org caps and the caps of this project only', async () => {
    const { event: e } = event('admin');

    const data = (await load(e)) as { caps: { scope: string; capUsd: number }[]; canEdit: boolean };

    expect(data.caps.map((c) => [c.scope, c.capUsd])).toEqual([['org_member', 20], ['project_total', 100]]);
    expect(data.canEdit).toBe(true);
  });

  it('a member sees the page but cannot edit', async () => {
    expect(((await load(event('member').event)) as { canEdit: boolean }).canEdit).toBe(false);
  });

  it('an admin saves a project cap bound to this project', async () => {
    const { event: e, fake } = event('admin', [['scope', 'project_member'], ['cap_usd', '7.5'], ['reset', 'monthly']]);

    await save(e);

    expect(fake.calls.find((c) => c.table === 'org_spend_caps' && c.op === 'insert')?.payload).toEqual({ org_id: 'org-1', scope: 'project_member', project_id: 'p-1', cap_usd: 7.5, reset: 'monthly' });
  });

  it('an org-wide member cap carries no project', async () => {
    const { event: e, fake } = event('owner', [['scope', 'org_member'], ['cap_usd', '5']]);

    await save(e);

    expect(fake.calls.find((c) => c.table === 'org_spend_caps' && c.op === 'insert')?.payload).toMatchObject({ scope: 'org_member', project_id: null, reset: 'none' });
  });

  it('a member writes nothing, and nonsense is refused', async () => {
    const asMember = event('member', [['scope', 'org_member'], ['cap_usd', '5']]);
    const nonsense = event('admin', [['scope', 'org_member'], ['cap_usd', '-3']]);

    await save(asMember.event);
    await save(nonsense.event);

    expect(asMember.fake.calls.some((c) => c.op === 'insert' || c.op === 'delete')).toBe(false);
    expect(nonsense.fake.calls.some((c) => c.op === 'insert' || c.op === 'delete')).toBe(false);
  });

  it('removing a cap deletes that scope for this project', async () => {
    const { event: e, fake } = event('admin', [['scope', 'project_total']]);

    await (actions.removeCap as (e: never) => Promise<unknown>)(e);

    expect(fake.calls.find((c) => c.table === 'org_spend_caps' && c.op === 'delete')?.filters).toEqual([['org_id', 'org-1'], ['scope', 'project_total'], ['project_id', 'p-1']]);
  });
});
