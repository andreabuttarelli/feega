import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isHttpError, isRedirect } from '@sveltejs/kit';

const mocks = vi.hoisted(() => ({
  env: {} as Record<string, string | undefined>,
  onboardingPathFor: vi.fn(),
  stash: vi.fn()
}));

vi.mock('$env/dynamic/private', () => ({ env: mocks.env }));
vi.mock('$lib/server/onboarding/onboarding', () => ({ onboardingPathFor: (...args: unknown[]) => mocks.onboardingPathFor(...args) }));
vi.mock('$lib/server/cloud/return-path', () => ({ stashReturn: (...args: unknown[]) => mocks.stash(...args) }));

import { fakeDb, type FakeDb } from '$lib/server/cloud/testing/fake-db';
import { actions, load } from './+page.server';

const SID = 'abcdefghij';

function sessionRow(over: Record<string, unknown> = {}) {
  return {
    id: SID,
    org_id: 'org-1',
    project_id: 'p1',
    host_user_id: 'host-1',
    project_name: 'Landing',
    visitor_role: 'editor',
    status: 'live',
    started_at: '2026-11-21T09:00:00Z',
    closed_at: null,
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    snapshot_path: null,
    ...over
  };
}

function run(db: FakeDb | null, search = '') {
  return (load as never as (event: unknown) => Promise<unknown>)({
    params: { id: SID },
    url: new URL(`https://oh.feega.app/s/${SID}${search}`),
    cookies: { get: () => undefined },
    locals: { safeGetSession: async () => ({ user: db ? { id: 'ada' } : null }), db: async () => db }
  });
}

async function thrown(promise: Promise<unknown>) {
  return promise.catch((error: unknown) => error);
}

beforeEach(() => {
  mocks.onboardingPathFor.mockReset().mockResolvedValue(null);
  mocks.stash.mockReset();
  for (const key of Object.keys(mocks.env)) {
    delete mocks.env[key];
  }
  mocks.env.RELAY_SIGNING_SECRET = 'relay-secret';
});

describe('/s/[id] load', () => {
  it('sends a signed-out visitor to login and remembers where to come back to', async () => {
    const error = (await thrown(run(null, '?next=/pricing'))) as { location: string };

    expect(isRedirect(error)).toBe(true);
    expect(error.location).toBe('/login');
    expect(mocks.stash).toHaveBeenCalledWith(expect.anything(), `/s/${SID}?next=/pricing`);
  });

  it('detours through onboarding and comes back to the same session', async () => {
    mocks.onboardingPathFor.mockResolvedValueOnce('/onboarding?next=x');

    const error = (await thrown(run(fakeDb({ share_sessions: [sessionRow()] })))) as { location: string };

    expect(error.location).toBe('/onboarding?next=x');
    expect(mocks.onboardingPathFor).toHaveBeenCalledWith(expect.anything(), expect.anything(), null, `/s/${SID}`);
  });

  it('redirects a member of a live session to the session origin auth endpoint', async () => {
    const error = (await thrown(run(fakeDb({ share_sessions: [sessionRow()] }), '?next=/about'))) as { status: number; location: string };

    expect(error.status).toBe(303);
    expect(error.location).toMatch(new RegExp(`^http://${SID}\\.localhost:8787/__feega/auth\\?token=[\\w.-]+&next=%2Fabout$`));
  });

  it('is a 404 when the session is not visible to the user', async () => {
    const error = await thrown(run(fakeDb()));

    expect(isHttpError(error, 404)).toBe(true);
  });

  it('is a 403 for a member the host removed', async () => {
    const db = fakeDb({ share_sessions: [sessionRow()], share_members: [{ session_id: SID, org_id: 'org-1', user_id: 'ada', role: 'editor', removed_at: '2026-11-21T09:30:00Z' }] });

    expect(isHttpError(await thrown(run(db)), 403)).toBe(true);
  });

  it('returns the read-only page data for a closed session', async () => {
    const db = fakeDb({ share_sessions: [sessionRow({ status: 'closed', closed_at: '2026-11-21T09:50:00Z', snapshot_path: 'org-1/abcdefghij.zip' })] });

    expect(await run(db)).toMatchObject({ sid: SID, projectName: 'Landing', snapshot: true, comments: [], revisions: [], status: 'open', mayDecide: true });
  });

  it('lists the revisions with their verdicts and tells the host they cannot decide', async () => {
    const db = fakeDb({
      share_sessions: [sessionRow({ status: 'closed', closed_at: '2026-11-21T09:50:00Z', host_user_id: 'ada' })],
      share_revisions: [{ id: 'r1', session_id: SID, org_id: 'org-1', number: 1, author_id: 'ada', summary: 'Round one', changes: [], created_at: '2026-11-21T09:10:00Z' }],
      share_verdicts: [{ revision_id: 'r1', session_id: SID, org_id: 'org-1', reviewer_id: 'vera', reviewer_name: 'Vera', verdict: 'approved', note: null, decided_at: '2026-11-21T09:20:00Z' }]
    });

    expect(await run(db)).toMatchObject({ status: 'approved', mayDecide: false, revisions: [{ id: 'r1', summary: 'Round one', status: 'approved' }] });
  });
});

describe('/s/[id] verdict action', () => {
  const decide = (db: FakeDb | null, fields: Record<string, string>) => {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => form.set(key, value));

    return (actions.verdict as never as (event: unknown) => Promise<unknown>)({
      params: { id: SID },
      request: new Request('https://oh.feega.app', { method: 'POST', body: form }),
      locals: { safeGetSession: async () => ({ user: db ? { id: 'ada' } : null }), db: async () => db }
    });
  };

  const seeded = () =>
    fakeDb(
      {
        share_sessions: [sessionRow({ status: 'closed', closed_at: '2026-11-21T09:50:00Z' })],
        share_revisions: [{ id: 'r1', session_id: SID, org_id: 'org-1', number: 1, author_id: 'host-1', summary: 'Round one', changes: [], created_at: '2026-11-21T09:10:00Z' }],
        profiles: [{ id: 'ada', name: 'Ada', email: 'a@x.co' }]
      },
      { unique: { share_verdicts: ['revision_id', 'reviewer_id'] } }
    );

  it('records the verdict of the signed-in reviewer', async () => {
    const db = seeded();

    await decide(db, { revisionId: 'r1', verdict: 'changes_requested', note: 'Tighter' });

    expect(db.tables.share_verdicts).toMatchObject([{ revision_id: 'r1', reviewer_id: 'ada', reviewer_name: 'Ada', verdict: 'changes_requested', note: 'Tighter' }]);
  });

  it('answers 400 to a verdict nobody knows', async () => {
    const result = (await decide(seeded(), { revisionId: 'r1', verdict: 'maybe' })) as { status: number };

    expect(result.status).toBe(400);
  });

  it('answers 401 when signed out', async () => {
    const result = (await decide(null, { revisionId: 'r1', verdict: 'approved' })) as { status: number };

    expect(result.status).toBe(401);
  });
});
