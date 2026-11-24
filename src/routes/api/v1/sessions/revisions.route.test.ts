import { beforeEach, describe, expect, it, vi } from 'vitest';
import { json } from '@sveltejs/kit';

const mocks = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
  call: null as unknown
}));

vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
vi.mock('$lib/server/stripe', () => ({ cloudSeatCount: async () => 0 }));
vi.mock('$lib/server/cli-auth', () => ({
  openOrg: async () => (mocks.call ? { call: mocks.call } : { error: json({ error: 'Missing or invalid Authorization header' }, { status: 401 }) })
}));

import { fakeDb, type FakeDb } from '$lib/server/cloud/testing/fake-db';
import { GET as LIST, POST as PUBLISH } from './[id]/revisions/+server';
import { POST as DECIDE } from './[id]/revisions/[rid]/verdict/+server';
import { GET as REVIEW } from './[id]/review/+server';
import { POST as ADD_COMMENT } from './[id]/comments/+server';

const ORG = 'org-1';
const SID = 'abcdefghij';
const FUTURE = new Date(Date.now() + 3_600_000).toISOString();
const CHANGES = [{ file: 'src/Hero.tsx', added: 2, removed: 1 }];
const COMMENT = { body: 'Tighten', selector: 'h1', sourceFile: 'src/Hero.tsx', sourceLine: 3, sourceCol: 1 };

function seedDb(): FakeDb {
  return fakeDb(
    {
      orgs_members: [
        { org_id: ORG, user_id: 'host-1', role: 'owner' },
        { org_id: ORG, user_id: 'ada', role: 'viewer' }
      ],
      profiles: [
        { id: 'host-1', name: 'Grace', email: 'g@x.co' },
        { id: 'ada', name: 'Ada', email: 'a@x.co' }
      ],
      share_sessions: [
        { id: SID, org_id: ORG, project_id: 'p1', host_user_id: 'host-1', project_name: 'Landing', visitor_role: 'viewer', status: 'live', started_at: new Date().toISOString(), closed_at: null, expires_at: FUTURE, snapshot_path: null }
      ],
      share_members: [{ session_id: SID, org_id: ORG, user_id: 'ada', role: 'viewer', removed_at: null }]
    },
    { unique: { share_revisions: ['session_id', 'number'], share_verdicts: ['revision_id', 'reviewer_id'] } }
  );
}

function as(userId: string, db: FakeDb) {
  mocks.call = { supabase: db, user: { id: userId }, orgId: ORG };
}

function req(method: string, body?: unknown) {
  return new Request('https://oh.feega.app/api/v1/sessions', { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'content-type': 'application/json' } });
}

const publish = (body: unknown) => PUBLISH({ request: req('POST', body), params: { id: SID } } as never);
const list = () => LIST({ request: req('GET'), params: { id: SID } } as never);
const decide = (rid: string, body: unknown) => DECIDE({ request: req('POST', body), params: { id: SID, rid } } as never);
const review = () => REVIEW({ request: req('GET'), params: { id: SID } } as never);

beforeEach(() => {
  mocks.call = null;
  for (const key of Object.keys(mocks.env)) {
    delete mocks.env[key];
  }
  mocks.env.CLOUD_ORG_IDS = ORG;
});

describe('session revisions', () => {
  it('answers 401 without credentials', async () => {
    expect((await publish({ summary: 'R1', changes: CHANGES })).status).toBe(401);
  });

  it('answers 402 plan_required when the org has no Cloud plan', async () => {
    as('host-1', seedDb());
    mocks.env.CLOUD_ORG_IDS = 'another-org';

    const response = await publish({ summary: 'R1', changes: CHANGES });

    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({ error: 'plan_required' });
  });

  it('lets only the host publish a revision', async () => {
    as('ada', seedDb());

    expect((await publish({ summary: 'R1', changes: CHANGES })).status).toBe(403);
  });

  it('rejects a revision without a summary or with absolute paths', async () => {
    as('host-1', seedDb());

    expect((await publish({ summary: ' ', changes: CHANGES })).status).toBe(400);
    expect((await publish({ summary: 'R1', changes: [{ file: '/etc/passwd', added: 0, removed: 0 }] })).status).toBe(400);
  });

  it('publishes round one, a reviewer requests changes, the host publishes round two', async () => {
    const db = seedDb();
    as('host-1', db);
    const first = (await (await publish({ summary: 'Round one', changes: CHANGES })).json()) as { id: string; number: number };
    as('ada', db);
    expect((await decide(first.id, { verdict: 'changes_requested', note: 'Too tight' })).status).toBe(200);
    as('host-1', db);
    await publish({ summary: 'Round two', changes: [] });

    const listed = (await (await list()).json()) as { status: string; revisions: { number: number; status: string }[] };

    expect(listed.revisions.map((revision) => [revision.number, revision.status])).toEqual([
      [1, 'changes_requested'],
      [2, 'open']
    ]);
    expect(listed.status).toBe('open');
  });

  it('refuses a verdict from the host, an unknown verdict and an unknown revision', async () => {
    const db = seedDb();
    as('host-1', db);
    const first = (await (await publish({ summary: 'R1', changes: [] })).json()) as { id: string };

    expect((await decide(first.id, { verdict: 'approved' })).status).toBe(403);
    as('ada', db);
    expect((await decide(first.id, { verdict: 'maybe' })).status).toBe(400);
    expect((await decide('missing', { verdict: 'approved' })).status).toBe(404);
  });

  it('tells the agent the latest verdict and the unresolved comments', async () => {
    const db = seedDb();
    as('host-1', db);
    const first = (await (await publish({ summary: 'R1', changes: [] })).json()) as { id: string };
    as('ada', db);
    await ADD_COMMENT({ request: req('POST', { ...COMMENT, revisionId: first.id }), params: { id: SID } } as never);
    await decide(first.id, { verdict: 'changes_requested' });
    as('host-1', db);

    const body = (await (await review()).json()) as { status: string; revision: { number: number }; openComments: { revisionId: string; body: string }[] };

    expect(body.status).toBe('changes_requested');
    expect(body.revision.number).toBe(1);
    expect(body.openComments).toMatchObject([{ body: 'Tighten', revisionId: first.id }]);
  });

  it('refuses a comment tied to a revision of no session of ours', async () => {
    as('ada', seedDb());

    const response = await ADD_COMMENT({ request: req('POST', { ...COMMENT, revisionId: 'elsewhere' }), params: { id: SID } } as never);

    expect(response.status).toBe(404);
  });
});
