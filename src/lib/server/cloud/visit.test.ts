import { describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({} as Record<string, string | undefined>));
vi.mock('$env/dynamic/private', () => ({ env }));

import { fakeDb } from './testing/fake-db';
import { TokenCheck, verifyToken } from './token';
import { safeVisitorPath, visit, VisitKind } from './visit';

const SECRET = 'relay-secret';
const NOW = new Date('2026-11-21T10:00:00Z');
const SID = 'abcdefghij';

function session(over: Record<string, unknown> = {}) {
  return {
    id: SID,
    org_id: 'org-1',
    project_id: 'p1',
    host_user_id: 'host-1',
    project_name: 'Landing',
    visitor_role: 'viewer',
    status: 'live',
    started_at: '2026-11-21T09:00:00Z',
    closed_at: null,
    expires_at: '2026-11-21T21:00:00Z',
    snapshot_path: null,
    ...over
  };
}

const run = (db: ReturnType<typeof fakeDb>, userId: string, next: string | null = '/dashboard') => visit(db, { sid: SID, userId, next, secret: SECRET, now: NOW });

describe('visit', () => {
  it('sends a member to the session origin with a signed visitor token and the path to open', async () => {
    const db = fakeDb({ share_sessions: [session()] });

    const result = await run(db, 'ada');

    expect(result.kind).toBe(VisitKind.Enter);
    const url = new URL((result as { url: string }).url);
    expect(url.origin).toBe(`http://${SID}.localhost:8787`);
    expect(url.pathname).toBe('/__feega/auth');
    expect(url.searchParams.get('next')).toBe('/dashboard');

    const verdict = await verifyToken(url.searchParams.get('token')!, SECRET, NOW.getTime());
    expect(verdict).toMatchObject({ check: TokenCheck.Valid, claims: { sid: SID, role: 'viewer', sub: 'ada', org: 'org-1' } });
  });

  it('builds the session origin from SESSION_ORIGIN_TEMPLATE', async () => {
    env.SESSION_ORIGIN_TEMPLATE = 'https://{sid}.sessions.test';
    const db = fakeDb({ share_sessions: [session()] });

    const result = await run(db, 'ada');

    expect(new URL((result as { url: string }).url).origin).toBe(`https://${SID}.sessions.test`);
    delete env.SESSION_ORIGIN_TEMPLATE;
  });

  it('records the visitor as a member with the session role', async () => {
    const db = fakeDb({ share_sessions: [session({ visitor_role: 'editor' })] });

    await run(db, 'ada');

    expect(db.tables.share_members).toEqual([expect.objectContaining({ user_id: 'ada', role: 'editor', org_id: 'org-1' })]);
  });

  it('gives the visitor the promoted role, not the session default', async () => {
    const db = fakeDb({ share_sessions: [session()], share_members: [{ session_id: SID, org_id: 'org-1', user_id: 'ada', role: 'editor', removed_at: null }] });

    const result = await run(db, 'ada');
    const token = new URL((result as { url: string }).url).searchParams.get('token')!;

    expect(await verifyToken(token, SECRET, NOW.getTime())).toMatchObject({ claims: { role: 'editor' } });
  });

  it('lets the host in as an editor without adding a member row', async () => {
    const db = fakeDb({ share_sessions: [session()] });

    const result = await run(db, 'host-1');
    const token = new URL((result as { url: string }).url).searchParams.get('token')!;

    expect(await verifyToken(token, SECRET, NOW.getTime())).toMatchObject({ claims: { role: 'editor' } });
    expect(db.tables.share_members ?? []).toHaveLength(0);
  });

  it('caps the token at the session expiry', async () => {
    const db = fakeDb({ share_sessions: [session({ expires_at: '2026-11-21T10:30:00Z' })] });

    const result = await run(db, 'ada');
    const token = new URL((result as { url: string }).url).searchParams.get('token')!;

    expect(await verifyToken(token, SECRET, NOW.getTime())).toMatchObject({ claims: { exp: Date.parse('2026-11-21T10:30:00Z') / 1000 } });
  });

  it('is not found for a session the user cannot see', async () => {
    expect(await run(fakeDb(), 'ada')).toEqual({ kind: VisitKind.NotFound });
  });

  it('refuses a member the host removed', async () => {
    const db = fakeDb({ share_sessions: [session()], share_members: [{ session_id: SID, org_id: 'org-1', user_id: 'ada', role: 'editor', removed_at: '2026-11-21T09:30:00Z' }] });

    expect(await run(db, 'ada')).toEqual({ kind: VisitKind.Removed });
  });

  it('shows a closed session read only, with its snapshot and every comment', async () => {
    const db = fakeDb({
      share_sessions: [session({ status: 'closed', closed_at: '2026-11-21T09:50:00Z', snapshot_path: 'org-1/abcdefghij.zip' })],
      share_comments: [{ id: 'c1', session_id: SID, author_id: 'ada', author_name: 'Ada', body: 'b', selector: 's', source_file: 'f', source_line: 1, source_col: 1, parent_id: null, created_at: '2026-11-21T09:10:00Z', resolved_at: '2026-11-21T09:20:00Z', resolved_by: 'host-1' }]
    });

    const result = await run(db, 'ada');

    expect(result).toMatchObject({ kind: VisitKind.Ended, ended: { projectName: 'Landing', endedAt: '2026-11-21T09:50:00Z', snapshot: true } });
    expect((result as { ended: { comments: unknown[] } }).ended.comments).toHaveLength(1);
    expect(db.tables.share_members ?? []).toHaveLength(0);
  });

  it('treats an expired live session as ended', async () => {
    const db = fakeDb({ share_sessions: [session({ expires_at: '2026-11-21T09:59:00Z' })] });

    expect((await run(db, 'ada')).kind).toBe(VisitKind.Ended);
  });
});

describe('safeVisitorPath', () => {
  it('keeps same-origin paths and drops anything that could leave the session origin', () => {
    expect(safeVisitorPath('/a/b?c=1')).toBe('/a/b?c=1');
    expect(safeVisitorPath('//evil.test')).toBe('/');
    expect(safeVisitorPath('/\\evil.test')).toBe('/');
    expect(safeVisitorPath('https://evil.test')).toBe('/');
    expect(safeVisitorPath(null)).toBe('/');
  });
});
