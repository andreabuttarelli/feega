import { beforeEach, describe, expect, it, vi } from 'vitest';
import { json } from '@sveltejs/kit';

const mocks = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
  call: null as unknown,
  pushed: [] as string[]
}));

vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
vi.mock('$lib/server/cli-auth', () => ({
  openOrg: async () => (mocks.call ? { call: mocks.call } : { error: json({ error: 'Missing or invalid Authorization header' }, { status: 401 }) })
}));
vi.mock('$lib/server/cloud/notify-db', () => ({
  dbNotifyStore: {
    memberIds: async () => ['host-1', 'ada'],
    subscriptionsOf: async (ids: string[]) => {
      mocks.pushed.push(...ids);
      return [];
    },
    dropSubscriptions: async () => {}
  }
}));

import { TokenCheck, verifyToken } from '$lib/server/cloud/token';
import { fakeDb, type FakeDb } from '$lib/server/cloud/testing/fake-db';
import { GET, POST } from './+server';
import { POST as CLOSE } from './[id]/close/+server';
import { GET as LIST_COMMENTS, POST as ADD_COMMENT } from './[id]/comments/+server';
import { PATCH as RESOLVE } from './[id]/comments/[cid]/+server';
import { POST as SNAPSHOT } from './[id]/snapshots/+server';
import { POST as SET_ROLE } from './[id]/members/[userId]/+server';

const ORG = 'org-1';
const SID = 'abcdefghij';
const SECRET = 'relay-secret';
const FUTURE = new Date(Date.now() + 3_600_000).toISOString();

function seedDb(extra: Record<string, Record<string, unknown>[]> = {}): FakeDb {
  return fakeDb(
    {
      orgs_members: [
        { org_id: ORG, user_id: 'host-1', role: 'owner' },
        { org_id: ORG, user_id: 'ada', role: 'member' },
        { org_id: ORG, user_id: 'vera', role: 'viewer' }
      ],
      profiles: [
        { id: 'host-1', name: 'Grace', email: 'g@x.co' },
        { id: 'ada', name: 'Ada', email: 'a@x.co' }
      ],
      share_sessions: [
        {
          id: SID,
          org_id: ORG,
          project_id: 'p1',
          host_user_id: 'host-1',
          project_name: 'Landing',
          visitor_role: 'editor',
          status: 'live',
          started_at: new Date().toISOString(),
          closed_at: null,
          expires_at: FUTURE,
          snapshot_path: null
        }
      ],
      ...extra
    },
    { unique: { cloud_projects: ['org_id', 'name'], share_members: ['session_id', 'user_id'] } }
  );
}

function as(userId: string, db: FakeDb, orgId = ORG) {
  mocks.call = { supabase: db, user: { id: userId }, orgId };
}

function req(method: string, body?: unknown, path = 'https://oh.feega.app/api/v1/sessions') {
  return new Request(path, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'content-type': 'application/json' } });
}

const COMMENT = { body: 'Tighten', selector: 'h1', sourceFile: 'src/Hero.tsx', sourceLine: 3, sourceCol: 1 };

beforeEach(() => {
  mocks.call = null;
  mocks.pushed.length = 0;
  for (const key of Object.keys(mocks.env)) {
    delete mocks.env[key];
  }
  mocks.env.RELAY_SIGNING_SECRET = SECRET;
  mocks.env.CLOUD_ORG_IDS = ORG;
});

describe('POST /api/v1/sessions', () => {
  const post = (body: unknown) => POST({ request: req('POST', body), url: new URL('https://oh.feega.app/api/v1/sessions') } as never);

  it('answers 401 without credentials', async () => {
    expect((await post({ projectName: 'P', visitorRole: 'viewer' })).status).toBe(401);
  });

  it('answers 402 plan_required when the org is not entitled to Cloud', async () => {
    as('host-1', seedDb());
    mocks.env.CLOUD_ORG_IDS = 'some-other-org';

    const response = await post({ projectName: 'P', visitorRole: 'viewer' });

    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({ error: 'plan_required' });
  });

  it('answers 403 to an org viewer, who has no editor seat', async () => {
    as('vera', seedDb());

    expect((await post({ projectName: 'P', visitorRole: 'viewer' })).status).toBe(403);
  });

  it('rejects a bad project name or role', async () => {
    as('host-1', seedDb());

    expect((await post({ projectName: '  ', visitorRole: 'viewer' })).status).toBe(400);
    expect((await post({ projectName: 'P', visitorRole: 'admin' })).status).toBe(400);
  });

  it('creates the session and returns a host token the relay can verify', async () => {
    const db = seedDb();
    as('host-1', db);

    const response = await post({ projectName: 'Landing', visitorRole: 'viewer' });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.url).toBe(`http://${body.id}.localhost:8787`);
    expect(db.tables.share_sessions.some((row) => row.id === body.id)).toBe(true);

    const verdict = await verifyToken(body.hostToken, SECRET);
    expect(verdict).toMatchObject({ check: TokenCheck.Valid, claims: { sid: body.id, role: 'host', sub: 'host-1', org: ORG } });
    if (verdict.check === TokenCheck.Valid) {
      expect(verdict.claims.exp).toBe(Math.floor(new Date(body.expiresAt).getTime() / 1000));
    }
  });

  it('tells the other org members, never the host', async () => {
    as('host-1', seedDb());
    mocks.env.VAPID_PUBLIC_KEY = 'public';
    mocks.env.VAPID_PRIVATE_KEY = 'private';

    await post({ projectName: 'Landing', visitorRole: 'viewer' });

    expect(mocks.pushed).toEqual(['ada']);
  });

  it('uses the dev origin template when configured', async () => {
    as('host-1', seedDb());
    mocks.env.SESSION_ORIGIN_TEMPLATE = 'http://{sid}.localhost:8787';

    const body = await (await post({ projectName: 'Landing', visitorRole: 'viewer' })).json();

    expect(body.url).toBe(`http://${body.id}.localhost:8787`);
  });
});

describe('GET /api/v1/sessions', () => {
  it('lists the live sessions of the org with host name and url', async () => {
    as('ada', seedDb());

    const response = await GET({ request: req('GET'), url: new URL('https://oh.feega.app/api/v1/sessions?status=live') } as never);

    expect(await response.json()).toEqual({
      sessions: [{ id: SID, url: `http://${SID}.localhost:8787`, projectName: 'Landing', hostName: 'Grace', startedAt: expect.any(String), expiresAt: FUTURE, status: 'live' }]
    });
  });
});

describe('POST /api/v1/sessions/:id/close', () => {
  const close = (id = SID) => CLOSE({ request: req('POST'), params: { id } } as never);

  it('gives the host a snapshot upload url', async () => {
    const db = seedDb();
    as('host-1', db);

    const response = await close();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ snapshotUploadUrl: expect.stringContaining('/share-snapshots/org-1/abcdefghij.zip') });
    expect(db.tables.share_sessions[0].status).toBe('closed');
  });

  it('refuses a member who is not the host', async () => {
    as('ada', seedDb());

    expect((await close()).status).toBe(403);
  });

  it('does not reveal a session of another org', async () => {
    as('host-1', seedDb(), 'org-2');

    expect((await close()).status).toBe(404);
  });

  it('rejects a malformed id before touching the database', async () => {
    as('host-1', seedDb());

    expect((await close('../x')).status).toBe(404);
  });
});

describe('session comments', () => {
  const list = (query = '') => LIST_COMMENTS({ request: req('GET'), params: { id: SID }, url: new URL(`https://oh.feega.app/x${query}`) } as never);
  const add = (body: unknown) => ADD_COMMENT({ request: req('POST', body), params: { id: SID } } as never);

  it('a visitor posts a comment as themselves and the host lists it', async () => {
    const db = seedDb();
    as('ada', db);

    const created = await add(COMMENT);
    as('host-1', db);
    const listed = await (await list('?open=1')).json();

    expect(created.status).toBe(201);
    expect(listed.comments).toHaveLength(1);
    expect(listed.comments[0]).toMatchObject({ authorId: 'ada', authorName: 'Ada', sourceFile: 'src/Hero.tsx', resolvedAt: null });
  });

  it('rejects an absolute source path', async () => {
    as('ada', seedDb());

    const response = await add({ ...COMMENT, sourceFile: '/Users/ada/app/Hero.tsx' });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'bad_source_file' });
  });

  it('refuses a member the host removed', async () => {
    as('ada', seedDb({ share_members: [{ session_id: SID, org_id: ORG, user_id: 'ada', role: 'editor', removed_at: new Date().toISOString() }] }));

    expect((await add(COMMENT)).status).toBe(403);
  });

  it('resolves a comment and stops listing it as open', async () => {
    const db = seedDb();
    as('ada', db);
    const { id } = await (await add(COMMENT)).json();

    as('host-1', db);
    const patched = await RESOLVE({ request: req('PATCH', { resolved: true, note: 'done' }), params: { id: SID, cid: id } } as never);
    const open = await (await list('?open=1')).json();

    expect(patched.status).toBe(200);
    expect(await patched.json()).toMatchObject({ id, resolvedBy: 'host-1' });
    expect(open.comments).toEqual([]);
  });

  it('answers 404 for an unknown comment and 400 without resolved:true', async () => {
    as('host-1', seedDb());

    expect((await RESOLVE({ request: req('PATCH', { resolved: true }), params: { id: SID, cid: 'nope' } } as never)).status).toBe(404);
    expect((await RESOLVE({ request: req('PATCH', {}), params: { id: SID, cid: 'nope' } } as never)).status).toBe(400);
  });
});

describe('POST /api/v1/sessions/:id/members/:userId', () => {
  const setRole = (body: unknown, userId = 'vera') => SET_ROLE({ request: req('POST', body), params: { id: SID, userId } } as never);

  it('lets the host promote a teammate', async () => {
    const db = seedDb();
    as('host-1', db);

    const response = await setRole({ role: 'editor' });

    expect(response.status).toBe(200);
    expect(db.tables.share_members).toEqual([expect.objectContaining({ user_id: 'vera', role: 'editor', org_id: ORG })]);
  });

  it('refuses anyone but the host', async () => {
    as('ada', seedDb());

    expect((await setRole({ role: 'editor' })).status).toBe(403);
  });

  it('refuses someone outside the org and an invalid role', async () => {
    as('host-1', seedDb());

    expect((await setRole({ role: 'editor' }, 'stranger')).status).toBe(404);
    expect((await setRole({ role: 'owner' })).status).toBe(400);
  });
});

describe('POST /api/v1/sessions/:id/snapshots', () => {
  const snap = (body: unknown) => SNAPSHOT({ request: req('POST', body), params: { id: SID }, url: new URL('https://oh.feega.app/x') } as never);

  it('gives an editor a named version url and an upload url', async () => {
    const db = seedDb();
    as('ada', db);

    const response = await snap({ name: 'Before the redesign' });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.url).toMatch(new RegExp(`^https://oh\\.feega\\.app/s/${SID}/snapshot/v/before-the-redesign-[a-z2-7]{6}/index\\.html$`));
    expect(body.uploadUrl).toContain('/share-snapshots/org-1/abcdefghij/versions/before-the-redesign-');
    expect(db.tables.share_sessions[0].status).toBe('live');
  });

  it('refuses a viewer and an empty name', async () => {
    as('ada', seedDb({ share_members: [{ session_id: SID, org_id: ORG, user_id: 'ada', role: 'viewer', removed_at: null }] }));
    expect((await snap({ name: 'x' })).status).toBe(403);

    as('host-1', seedDb());
    expect((await snap({ name: ' ' })).status).toBe(400);
  });
});
