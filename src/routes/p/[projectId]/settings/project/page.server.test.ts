import { describe, expect, it } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { fakeDb } from '$lib/server/db/fake-db';
import { actions } from './+page.server';

const ORG = 'org-1';
const PROJECT = 'proj-1';
const BRAND = 'brand-1';
const NAME = 'Spring launch';
const OTHER = 'proj-2';
const CANVAS = 'canvas-2';
const USER = { id: 'user-1', email: 'u@example.com', user_metadata: {} };

function seed() {
  return {
    projects: [{ id: PROJECT, org_id: ORG, name: NAME }],
    brands: [{ id: BRAND, org_id: ORG, name: 'Acme', slug: 'acme', website: null }]
  };
}

function formEvent(fields: Record<string, string>, db: unknown) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value);
  }
  return {
    request: { formData: async () => fd },
    params: { projectId: PROJECT },
    cookies: { get: () => undefined },
    locals: { db: async () => db, safeGetSession: async () => ({ user: USER }) }
  };
}

type Action = (e: unknown) => Promise<unknown>;

async function run(name: keyof typeof actions, fields: Record<string, string>, db: unknown): Promise<unknown> {
  try {
    return await (actions[name] as Action)(formEvent(fields, db));
  } catch (thrown) {
    return thrown;
  }
}

const projectUpdate = (calls: ReturnType<typeof fakeDb>['calls']) =>
  calls.find((c) => c.table === 'projects' && c.op === 'update');

describe('settings/project actions', () => {
  it('rename scrive il nome nuovo sul progetto della sua org', async () => {
    const { db, calls } = fakeDb(seed(), { filter: true });

    const result = (await run('rename', { name: '  Autumn  ' }, db)) as { renamed: boolean };

    expect(result.renamed).toBe(true);
    expect(projectUpdate(calls)?.payload).toMatchObject({ name: 'Autumn' });
    expect(projectUpdate(calls)?.filters).toEqual(expect.arrayContaining([['id', PROJECT], ['org_id', ORG]]));
  });

  it('rename senza nome risponde 400 senza scrivere', async () => {
    const { db, calls } = fakeDb(seed(), { filter: true });

    const result = (await run('rename', { name: ' ' }, db)) as { status: number };

    expect(result.status).toBe(400);
    expect(projectUpdate(calls)).toBeUndefined();
  });

  it('linkBrand collega un brand della stessa org e torna alla sezione di partenza', async () => {
    const { db, calls } = fakeDb(seed(), { filter: true });

    const result = await run('linkBrand', { brandId: BRAND, returnTo: `/p/${PROJECT}/settings/video` }, db);

    expect(isRedirect(result)).toBe(true);
    expect((result as { location: string }).location).toBe(`/p/${PROJECT}/settings/video`);
    expect(projectUpdate(calls)?.payload).toMatchObject({ brand_id: BRAND });
  });

  it('linkBrand rifiuta un brand di un\'altra org', async () => {
    const { db, calls } = fakeDb(seed(), { filter: true });

    const result = (await run('linkBrand', { brandId: 'foreign' }, db)) as { status: number };

    expect(result.status).toBe(404);
    expect(projectUpdate(calls)).toBeUndefined();
  });

  it('linkBrand ignora un returnTo fuori dal progetto', async () => {
    const { db } = fakeDb(seed(), { filter: true });

    const result = await run('linkBrand', { brandId: BRAND, returnTo: 'https://evil.example' }, db);

    expect(isRedirect(result)).toBe(false);
    expect(result).toMatchObject({ linked: true });
  });

  it('unlinkBrand riporta brand_id a null', async () => {
    const { db, calls } = fakeDb(seed(), { filter: true });

    const result = (await run('unlinkBrand', {}, db)) as { unlinked: boolean };

    expect(result.unlinked).toBe(true);
    expect(projectUpdate(calls)?.payload).toMatchObject({ brand_id: null });
  });

  it('delete senza il nome esatto non archivia niente', async () => {
    const { db, calls } = fakeDb(seed(), { filter: true });

    const result = (await run('delete', { confirmName: 'spring launch' }, db)) as { status: number };

    expect(result.status).toBe(400);
    expect(projectUpdate(calls)).toBeUndefined();
  });

  it('delete col nome esatto archivia il progetto e atterra sulla dashboard', async () => {
    const { db, calls } = entryDb([{ id: OTHER, org_id: ORG, name: 'Other', updated_at: '2026-01-01', canvases: [] }]);

    const result = await run('delete', { confirmName: NAME }, db);

    expect(isRedirect(result)).toBe(true);
    expect((result as { location: string }).location).toBe('/app');
    expect(projectUpdate(calls)?.payload).toHaveProperty('archived_at');
    expect(calls.find((c) => c.op === 'delete')).toBeUndefined();
  });

  it('cancellato l unico progetto, ne nasce esattamente uno nuovo e non si passa da /app', async () => {
    const { db, calls } = entryDb([]);

    const result = await run('delete', { confirmName: NAME }, db);

    expect(isRedirect(result)).toBe(true);
    expect((result as { location: string }).location).not.toBe('/app');
    expect(calls.filter((c) => c.table === 'projects' && c.op === 'insert')).toHaveLength(1);
  });
});

function entryDb(others: Record<string, unknown>[]) {
  const rows: Record<string, Record<string, unknown>[]> = {
    projects: [{ id: PROJECT, org_id: ORG, name: NAME, updated_at: '2026-01-01', archived_at: null, canvases: [] }, ...others],
    profiles: [{ id: USER.id, email: USER.email, name: null, avatar_url: null }],
    orgs_members: [{ user_id: USER.id, role: 'owner', orgs: { id: ORG, name: 'Org', slug: 'org' } }],
    canvases: [{ id: CANVAS, org_id: ORG, project_id: OTHER, name: 'C', viewport: null }]
  };
  const fake = fakeDb(rows, { filter: true });
  const applied = new Set<unknown>();
  const from = fake.db.from.bind(fake.db);
  (fake.db as unknown as { from: unknown }).from = (table: string) => {
    for (const call of fake.calls.filter((c) => c.op === 'update' && !applied.has(c))) {
      applied.add(call);
      const matching = (rows[call.table] ?? []).filter((row) => call.filters.every(([k, v]) => row[k] === v));
      matching.forEach((row) => Object.assign(row, call.payload));
    }
    return from(table as never);
  };
  return fake;
}
