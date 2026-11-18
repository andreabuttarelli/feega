import { describe, expect, it } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { load, actions } from './spend';

const PROJECT_ID = 'p-1';

const shell = (role: string, projectId: string | null) => ({ org: { id: 'org-1', name: 'Acme', slug: 'acme', role }, project: projectId ? { id: projectId } : null, brand: null });

const formOf = (entries: [string, string][]) => {
  const form = new FormData();
  entries.forEach(([key, value]) => form.append(key, value));
  return form;
};

function event(role: string, entries: [string, string][] = [], projectId: string | null = PROJECT_ID) {
  const fake = fakeDb(
    {
      orgs_members: [{ org_id: 'org-1', user_id: 'user-1', role }],
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
      params: {},
      parent: async () => shell(role, projectId),
      locals: { supabase: fake.db },
      request: { formData: async () => formOf(entries) }
    } as never
  };
}

type Loaded = { caps: { scope: string; capUsd: number }[]; scopes: readonly string[]; canEdit: boolean };

const save = (e: never) => (actions.saveCap as (e: never) => Promise<unknown>)(e);
const insertOf = (fake: ReturnType<typeof event>['fake']) => fake.calls.find((c) => c.table === 'org_spend_caps' && c.op === 'insert');
const wrote = (fake: ReturnType<typeof event>['fake']) => fake.calls.some((c) => c.op === 'insert' || c.op === 'delete');

describe('the dashboard spend settings', () => {
  it('shows and edits the org member caps only', async () => {
    const { event: e } = event('admin', [], null);

    const data = (await load(e)) as Loaded;

    expect(data.caps.map((c) => [c.scope, c.capUsd])).toEqual([['org_member', 20]]);
    expect(data.scopes).toEqual(['org_member']);
    expect(data.canEdit).toBe(true);
  });

  it('an org member cap carries no project', async () => {
    const { event: e, fake } = event('owner', [['scope', 'org_member'], ['cap_usd', '5']], null);

    await save(e);

    expect(insertOf(fake)?.payload).toMatchObject({ scope: 'org_member', project_id: null, reset: 'none' });
  });

  it('refuses a project cap', async () => {
    const { event: e, fake } = event('admin', [['scope', 'project_total'], ['cap_usd', '5']], null);

    await save(e);

    expect(wrote(fake)).toBe(false);
  });
});

describe('the project spend settings', () => {
  it('show the caps of this project only', async () => {
    const { event: e } = event('admin');

    const data = (await load(e)) as Loaded;

    expect(data.caps.map((c) => [c.scope, c.capUsd])).toEqual([['project_total', 100]]);
    expect(data.scopes).toEqual(['project_member', 'project_total']);
  });

  it('a member sees the page but cannot edit', async () => {
    expect(((await load(event('member').event)) as Loaded).canEdit).toBe(false);
  });

  it('an admin saves a project cap bound to this project', async () => {
    const { event: e, fake } = event('admin', [['scope', 'project_member'], ['cap_usd', '7.5'], ['reset', 'monthly']]);

    await save(e);

    expect(insertOf(fake)?.payload).toEqual({ org_id: 'org-1', scope: 'project_member', project_id: 'p-1', cap_usd: 7.5, reset: 'monthly' });
  });

  it('refuses the org member cap, which lives in the dashboard', async () => {
    const { event: e, fake } = event('admin', [['scope', 'org_member'], ['cap_usd', '5']]);

    await save(e);

    expect(wrote(fake)).toBe(false);
  });

  it('a member writes nothing, and nonsense is refused', async () => {
    const asMember = event('member', [['scope', 'project_total'], ['cap_usd', '5']]);
    const nonsense = event('admin', [['scope', 'project_total'], ['cap_usd', '-3']]);

    await save(asMember.event);
    await save(nonsense.event);

    expect(wrote(asMember.fake)).toBe(false);
    expect(wrote(nonsense.fake)).toBe(false);
  });

  it('removing a cap deletes that scope for this project', async () => {
    const { event: e, fake } = event('admin', [['scope', 'project_total']]);

    await (actions.removeCap as (e: never) => Promise<unknown>)(e);

    expect(fake.calls.find((c) => c.table === 'org_spend_caps' && c.op === 'delete')?.filters).toEqual([['org_id', 'org-1'], ['scope', 'project_total'], ['project_id', 'p-1']]);
  });
});
