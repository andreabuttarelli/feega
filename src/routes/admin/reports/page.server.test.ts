import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, type FakeDb } from '$lib/server/db/fake-db';

const sendEmail = vi.fn(async (_m: { to: string; subject: string; text?: string }) => {});
const updateUserById = vi.fn(async () => ({ error: null }));
let fake: FakeDb;

vi.mock('$lib/server/db/client', () => ({
  createServiceRoleDb: () => Object.assign(fake.db, { auth: { admin: { updateUserById } } })
}));
vi.mock('$lib/server/email', () => ({ sendEmail: (m: { to: string; subject: string }) => sendEmail(m) }));
vi.mock('$lib/server/internal-users', () => ({
  internalEmails: () => ['ops@feega.app'],
  isInternalEmail: (e: string | null | undefined) => e === 'ops@feega.app'
}));

import { actions, load } from './+page.server';

const REPORT = {
  id: 'r-1',
  org_id: 'o-1',
  canvas_id: 'c-1',
  node_id: 'n-1',
  target_url: 'https://feega.app/s/tok',
  affected_user_id: 'u-author',
  reason: 'copyright',
  details: { work: 'Sunset', name: 'Ada', email: 'ada@example.com', signature: 'Ada' },
  reporter_email: 'ada@example.com',
  status: 'open',
  removed_share_token: null,
  counter_token_hash: null,
  restore_after: null,
  suit_filed_at: null,
  created_at: '2026-10-01T00:00:00Z',
  priority: 3
};

function event(email: string, fields: Record<string, string> = {}) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    body.set(k, v);
  }
  return {
    request: new Request('https://feega.app/admin/reports', { method: 'POST', body }),
    url: new URL('https://feega.app/admin/reports'),
    locals: { safeGetSession: async () => ({ session: {}, user: { id: 'admin-1', email } }) }
  } as never;
}

const update = (table: string) => fake.calls.find((c) => c.table === table && c.op === 'update')?.payload as Record<string, unknown> | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  fake = fakeDb({
    content_reports: [REPORT],
    canvases: [{ id: 'c-1', share_token: 'tok' }],
    account_strikes: [{ weight: 1 }],
    profiles: [{ id: 'u-author', email: 'author@example.com' }]
  });
});

describe('/admin/reports', () => {
  it('is a 404 for anyone outside the team', async () => {
    await expect(load(event('someone@example.com'))).rejects.toMatchObject({ status: 404 });
    await expect(actions.decide(event('someone@example.com', { id: 'r-1', decision: 'dismiss', ground: 'no_violation', note: 'x' }))).rejects.toMatchObject({ status: 404 });
  });

  it('lists the queue for the team', async () => {
    const data = (await load(event('ops@feega.app'))) as { reports: unknown[] };
    expect(data.reports).toHaveLength(1);
  });

  it('a decision without a ground from the table is refused', async () => {
    const result = await actions.decide(event('ops@feega.app', { id: 'r-1', decision: 'remove', ground: 'no_violation', note: 'x' }));
    expect(result).toMatchObject({ status: 400 });
    expect(update('nodes')).toBeUndefined();
  });

  it('removing hides the node, revokes the share link, strikes the author and emails both sides', async () => {
    const result = await actions.decide(event('ops@feega.app', { id: 'r-1', decision: 'remove', ground: 'copyright', note: 'Exact copy.' }));

    expect(result).toMatchObject({ success: true });
    expect(update('nodes')).toMatchObject({ deleted_at: expect.any(String) });
    expect(update('canvases')).toMatchObject({ share_token: null });
    expect(fake.calls.find((c) => c.table === 'account_strikes' && c.op === 'insert')?.payload).toMatchObject({ user_id: 'u-author', weight: 1 });
    expect(update('content_reports')).toMatchObject({
      status: 'actioned',
      decision: 'remove',
      ground: 'copyright',
      decided_by: 'admin-1',
      removed_share_token: 'tok',
      counter_token_hash: expect.any(String)
    });

    const statement = sendEmail.mock.calls.map(([m]) => m).find((m) => m.to === 'author@example.com');
    expect(statement?.text).toContain('/report/counter/r-1?t=');
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ada@example.com', subject: expect.stringContaining('Decision') }));
  });

  it('one strike is a warning: the account is not banned', async () => {
    await actions.decide(event('ops@feega.app', { id: 'r-1', decision: 'remove', ground: 'copyright', note: 'Exact copy.' }));
    expect(updateUserById).toHaveBeenCalledWith('u-author', { ban_duration: 'none' });
  });

  it('reaching the suspension threshold bans the account for thirty days', async () => {
    fake = fakeDb({ content_reports: [REPORT], canvases: [], account_strikes: [{ weight: 1 }, { weight: 1 }], profiles: [] });
    await actions.decide(event('ops@feega.app', { id: 'r-1', decision: 'remove', ground: 'copyright', note: 'Again.' }));
    expect(updateUserById).toHaveBeenCalledWith('u-author', { ban_duration: '720h' });
  });

  it('suspend bans even on a first strike', async () => {
    await actions.decide(event('ops@feega.app', { id: 'r-1', decision: 'suspend', ground: 'copyright', note: 'Blatant.' }));
    expect(updateUserById).toHaveBeenCalledWith('u-author', { ban_duration: '720h' });
  });

  it('dismissing touches neither content nor account', async () => {
    const result = await actions.decide(event('ops@feega.app', { id: 'r-1', decision: 'dismiss', ground: 'no_violation', note: 'Own photo.' }));
    expect(result).toMatchObject({ success: true });
    expect(update('nodes')).toBeUndefined();
    expect(updateUserById).not.toHaveBeenCalled();
    expect(update('content_reports')).toMatchObject({ status: 'dismissed' });
  });

  it('restoring brings the node and the share link back and revokes the strike', async () => {
    fake = fakeDb({ content_reports: [{ ...REPORT, status: 'actioned', removed_share_token: 'tok' }], canvases: [], account_strikes: [], profiles: [] });
    await actions.decide(event('ops@feega.app', { id: 'r-1', decision: 'restore', ground: 'reversed', note: 'Licence shown.' }));

    expect(update('nodes')).toMatchObject({ deleted_at: null });
    expect(update('canvases')).toMatchObject({ share_token: 'tok' });
    expect(update('account_strikes')).toMatchObject({ revoked_at: expect.any(String) });
    expect(update('content_reports')).toMatchObject({ status: 'restored' });
  });

  it('records that the claimant filed suit, which stops the restore timer', async () => {
    const result = await actions.suitFiled(event('ops@feega.app', { id: 'r-1' }));
    expect(result).toMatchObject({ success: true });
    expect(update('content_reports')).toMatchObject({ suit_filed_at: expect.any(String) });
  });
});
