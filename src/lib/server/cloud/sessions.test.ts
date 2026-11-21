import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from './testing/fake-db';
import { isSid, newSid } from './sid';
import { closeSession, joinSession, liveSessions, Outcome, roleIn, sessionFor, setMemberRole, startSession, SESSION_MAX_MS, type SessionRow } from './sessions';

const NOW = new Date('2026-11-21T10:00:00Z');
const ORG = 'org-1';
const HOST = 'host-1';

function row(over: Partial<SessionRow> = {}): SessionRow {
  return {
    id: 'abcdefghij',
    org_id: ORG,
    project_id: 'proj-1',
    host_user_id: HOST,
    project_name: 'Landing',
    visitor_role: 'editor',
    status: 'live',
    started_at: NOW.toISOString(),
    closed_at: null,
    expires_at: new Date(NOW.getTime() + SESSION_MAX_MS).toISOString(),
    snapshot_path: null,
    ...over
  };
}

describe('sid', () => {
  it('is ten lowercase base32 characters', () => {
    for (let i = 0; i < 50; i++) {
      expect(isSid(newSid())).toBe(true);
    }
  });

  it('rejects anything else', () => {
    expect(isSid('ABCDEFGHIJ')).toBe(false);
    expect(isSid('abcdefghi')).toBe(false);
    expect(isSid('abcdefghi1')).toBe(false);
    expect(isSid('../../etc/x')).toBe(false);
  });
});

describe('startSession', () => {
  it('creates the project once and a live session that expires in 12 hours', async () => {
    const db = fakeDb({}, { unique: { cloud_projects: ['org_id', 'name'] } });

    const first = await startSession(db, { orgId: ORG, hostId: HOST, projectName: 'Landing', visitorRole: 'viewer', now: NOW });
    const second = await startSession(db, { orgId: ORG, hostId: HOST, projectName: 'Landing', visitorRole: 'editor', now: NOW });

    expect(db.tables.cloud_projects).toHaveLength(1);
    expect(first).toMatchObject({ org_id: ORG, host_user_id: HOST, status: 'live', visitor_role: 'viewer', expires_at: '2026-11-21T22:00:00.000Z' });
    expect(isSid(first.id)).toBe(true);
    expect(second.project_id).toBe(first.project_id);
  });

  it('retries when the generated id is already taken', async () => {
    const db = fakeDb({ share_sessions: [row({ id: 'aaaaaaaaaa' })] }, { unique: { share_sessions: ['id'] } });
    const real = crypto.getRandomValues.bind(crypto);
    const spy = vi.spyOn(crypto, 'getRandomValues').mockImplementationOnce((array) => (array as Uint8Array).fill(0) as never);
    spy.mockImplementation(real as never);

    const started = await startSession(db, { orgId: ORG, hostId: HOST, projectName: 'P', visitorRole: 'viewer', now: NOW });

    expect(started.id).not.toBe('aaaaaaaaaa');
    expect(db.tables.share_sessions).toHaveLength(2);
    spy.mockRestore();
  });
});

describe('liveSessions', () => {
  it('lists live, unexpired sessions of the org only, with the host name', async () => {
    const db = fakeDb({
      share_sessions: [
        row({ id: 'aaaaaaaaaa' }),
        row({ id: 'bbbbbbbbbb', status: 'closed' }),
        row({ id: 'cccccccccc', org_id: 'org-2' }),
        row({ id: 'dddddddddd', expires_at: '2026-11-21T09:00:00Z' })
      ],
      profiles: [{ id: HOST, name: 'Grace', email: 'g@x.co' }]
    });

    const live = await liveSessions(db, ORG, NOW);

    expect(live.map((entry) => entry.row.id)).toEqual(['aaaaaaaaaa']);
    expect(live[0].hostName).toBe('Grace');
  });
});

describe('sessionFor', () => {
  it('does not find a session of another org', async () => {
    const db = fakeDb({ share_sessions: [row()] });

    expect(await sessionFor(db, 'abcdefghij', 'org-2')).toBeNull();
    expect((await sessionFor(db, 'abcdefghij', ORG))?.id).toBe('abcdefghij');
  });
});

describe('roleIn', () => {
  it('is host for the host, the session default for a newcomer, the stored role for a member and nothing for a removed one', async () => {
    const db = fakeDb({
      share_members: [
        { session_id: 'abcdefghij', user_id: 'promoted', role: 'viewer', removed_at: null },
        { session_id: 'abcdefghij', user_id: 'kicked', role: 'editor', removed_at: '2026-11-21T10:30:00Z' }
      ]
    });
    const session = row();

    expect(await roleIn(db, session, HOST)).toBe('host');
    expect(await roleIn(db, session, 'newcomer')).toBe('editor');
    expect(await roleIn(db, session, 'promoted')).toBe('viewer');
    expect(await roleIn(db, session, 'kicked')).toBeNull();
  });
});

describe('joinSession', () => {
  it('records a visitor once with the session role and never overwrites a promotion', async () => {
    const db = fakeDb({}, { unique: { share_members: ['session_id', 'user_id'] } });
    const session = row({ visitor_role: 'viewer' });

    await joinSession(db, session, 'ada');
    db.tables.share_members[0].role = 'editor';
    await joinSession(db, session, 'ada');

    expect(db.tables.share_members).toHaveLength(1);
    expect(db.tables.share_members[0]).toMatchObject({ role: 'editor', org_id: ORG });
  });
});

describe('setMemberRole', () => {
  const members = { orgs_members: [{ org_id: ORG, user_id: 'ada' }] };

  it('only the host may change roles', async () => {
    const db = fakeDb(members);

    expect(await setMemberRole(db, row(), 'ada', 'ada', 'editor')).toBe(Outcome.NotHost);
  });

  it('refuses someone outside the org', async () => {
    const db = fakeDb(members);

    expect(await setMemberRole(db, row(), HOST, 'stranger', 'editor')).toBe(Outcome.NotMember);
    expect(db.tables.share_members ?? []).toHaveLength(0);
  });

  it('creates the membership, then promotes and reinstates it', async () => {
    const db = fakeDb(members);

    await setMemberRole(db, row({ visitor_role: 'viewer' }), HOST, 'ada', 'viewer');
    db.tables.share_members[0].removed_at = '2026-11-21T10:30:00Z';
    const outcome = await setMemberRole(db, row({ visitor_role: 'viewer' }), HOST, 'ada', 'editor');

    expect(outcome).toBe(Outcome.Done);
    expect(db.tables.share_members).toHaveLength(1);
    expect(db.tables.share_members[0]).toMatchObject({ role: 'editor', removed_at: null });
  });
});

describe('closeSession', () => {
  it('closes the session and hands the host a signed upload url for the org scoped snapshot', async () => {
    const db = fakeDb({ share_sessions: [row()] });

    const result = await closeSession(db, row(), HOST, NOW);

    expect(result).toEqual({ outcome: Outcome.Done, uploadUrl: 'https://storage.test/upload/share-snapshots/org-1/abcdefghij.zip?token=t' });
    expect(db.tables.share_sessions[0]).toMatchObject({ status: 'closed', closed_at: NOW.toISOString(), snapshot_path: 'org-1/abcdefghij.zip' });
    expect(db.uploads).toEqual(['share-snapshots/org-1/abcdefghij.zip']);
  });

  it('refuses anyone but the host and changes nothing', async () => {
    const db = fakeDb({ share_sessions: [row()] });

    expect(await closeSession(db, row(), 'ada', NOW)).toEqual({ outcome: Outcome.NotHost });
    expect(db.tables.share_sessions[0].status).toBe('live');
    expect(db.uploads).toEqual([]);
  });
});
