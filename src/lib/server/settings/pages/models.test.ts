import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';

vi.mock('$lib/server/canvas-catalogue', () => ({
  canvasModelCatalogue: async () => ({
    image: { choices: [{ id: 'img-a', label: 'Image A' }] },
    video: { choices: [{ id: 'vid-a', label: 'Video A' }] },
    model3d: { choices: [] }
  })
}));

const { load, actions } = await import('./models');

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
      org_model_allowlist: [{ org_id: 'org-1', medium: 'image', model_id: 'img-a' }]
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

describe('the Models settings page', () => {
  it('lists every offered model and what the org allows today', async () => {
    const { event: e } = event('admin');

    const data = (await load(e)) as { models: Record<string, { id: string }[]>; allowed: Record<string, string[]>; canEdit: boolean };

    expect(data.models.image.map((m) => m.id)).toEqual(['img-a']);
    expect(data.allowed.image).toEqual(['img-a']);
    expect(data.canEdit).toBe(true);
  });

  it('a member sees the page but cannot edit', async () => {
    const { event: e } = event('member');

    expect(((await load(e)) as { canEdit: boolean }).canEdit).toBe(false);
  });

  it('saving replaces the list of one medium', async () => {
    const { event: e, fake } = event('admin', [
      ['medium', 'video'],
      ['model_ids', 'vid-a']
    ]);

    await (actions.saveAllowlist as (e: never) => Promise<unknown>)(e);

    expect(fake.calls.find((c) => c.table === 'org_model_allowlist' && c.op === 'insert')?.payload).toEqual([{ org_id: 'org-1', medium: 'video', model_id: 'vid-a' }]);
  });

  it('saving as a member writes nothing', async () => {
    const { event: e, fake } = event('member', [
      ['medium', 'video'],
      ['model_ids', 'vid-a']
    ]);

    await (actions.saveAllowlist as (e: never) => Promise<unknown>)(e);

    expect(fake.calls.some((c) => c.op === 'delete' || c.op === 'insert')).toBe(false);
  });
});
