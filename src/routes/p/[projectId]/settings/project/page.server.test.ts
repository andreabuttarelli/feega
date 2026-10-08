import { describe, expect, it, vi } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { fakeDb } from '$lib/server/db/fake-db';
import { actions } from './+page.server';
import { OUTPUTS_PRESENT, SWITCH_REFUSAL_TEXT } from '$lib/server/uncensored-workspace/mode-switch';
import { UNCENSORED_LOCK_TEXT, UncensoredLock } from '$lib/uncensored-lock';

vi.mock('$app/environment', () => ({ dev: true, browser: false, building: false }));
vi.mock('$env/dynamic/private', () => ({ env: { UNCENSORED_DEV_MANUAL_VERIFICATION: 'true' } }));

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

  it('cancellato l unico progetto, ne nasce esattamente uno nuovo e si torna alla home del video', async () => {
    const { db, calls } = entryDb([]);

    const result = await run('delete', { confirmName: NAME }, db);

    expect(isRedirect(result)).toBe(true);
    expect((result as { location: string }).location).toBe('/app');
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

function gatedSeed(extra: Record<string, unknown[]> = {}) {
  return {
    projects: [{ id: PROJECT, org_id: ORG, name: NAME, mode: 'standard' }],
    orgs: [{ id: ORG, stripe_subscription_id: 'sub_1' }],
    org_uncensored_optins: [{ org_id: ORG, enabled_by: USER.id, enabled_at: '2026-09-29T10:00:00Z', disabled_at: null }],
    user_age_verifications: [{ id: 'v1', user_id: USER.id, provider: 'manual_admin', method: 'manual_admin', result: 'adult' }],
    assets: [],
    ai_calls: [],
    ...extra
  };
}

describe('settings/project setMode: uncensored is a switch on the project', () => {
  it('turns uncensored on when every gate passes and the notice is acknowledged', async () => {
    const { db, calls } = fakeDb(gatedSeed(), { filter: true });

    const result = await run('setMode', { mode: 'uncensored', acknowledge: 'on' }, db);

    expect(result).toMatchObject({ switched: true });
    expect(projectUpdate(calls)?.payload).toMatchObject({ mode: 'uncensored' });
  });

  it('refuses without the acknowledgment', async () => {
    const { db, calls } = fakeDb(gatedSeed(), { filter: true });

    const result = (await run('setMode', { mode: 'uncensored' }, db)) as { status: number };

    expect(result.status).toBe(400);
    expect(projectUpdate(calls)).toBeUndefined();
  });

  it('refuses an unverified user with the age step message', async () => {
    const { db, calls } = fakeDb(gatedSeed({ user_age_verifications: [] }), { filter: true });

    const result = (await run('setMode', { mode: 'uncensored', acknowledge: 'on' }, db)) as { status: number; data: { error: string } };

    expect(result.status).toBe(403);
    expect(result.data.error).toBe(UNCENSORED_LOCK_TEXT[UncensoredLock.AgeUnverified]);
    expect(projectUpdate(calls)).toBeUndefined();
  });

  it('switches back to standard when nothing was produced under uncensored', async () => {
    const { db, calls } = fakeDb(gatedSeed({ projects: [{ id: PROJECT, org_id: ORG, name: NAME, mode: 'uncensored' }] }), { filter: true });

    expect(await run('setMode', { mode: 'standard' }, db)).toMatchObject({ switched: true });
    expect(projectUpdate(calls)?.payload).toMatchObject({ mode: 'standard' });
  });

  it('refuses to switch back once uncensored outputs exist, with a clear message', async () => {
    const { db, calls } = fakeDb(
      gatedSeed({
        projects: [{ id: PROJECT, org_id: ORG, name: NAME, mode: 'uncensored' }],
        assets: [{ id: 'a1', org_id: ORG, project_id: PROJECT, uncensored_project: true }]
      }),
      { filter: true }
    );

    const result = (await run('setMode', { mode: 'standard' }, db)) as { status: number; data: { error: string } };

    expect(result.status).toBe(403);
    expect(result.data.error).toBe(SWITCH_REFUSAL_TEXT[OUTPUTS_PRESENT]);
    expect(projectUpdate(calls)).toBeUndefined();
  });
});
