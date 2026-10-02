import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, type FakeDb } from '$lib/server/db/fake-db';

const sendEmail = vi.fn(async (_m: { to: string; subject: string }) => {});
let fake: FakeDb;

vi.mock('$lib/server/db/client', () => ({ createServiceRoleDb: () => fake.db }));
vi.mock('$lib/server/email', () => ({ sendEmail: (m: { to: string; subject: string }) => sendEmail(m) }));
vi.mock('$lib/server/internal-users', () => ({ internalEmails: () => ['ops@feega.app'] }));

import { actions, load } from './+page.server';

const CANVAS = { id: 'c-1', org_id: 'o-1', share_token: 'tok' };
const NODE = { id: 'n-1', org_id: 'o-1', canvas_id: 'c-1', actor_id: 'u-author' };

function event(fields: Record<string, string>, query = '?share=tok&node=n-1') {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    body.set(k, v);
  }
  return {
    request: new Request('https://feega.app/report', { method: 'POST', body }),
    url: new URL(`https://feega.app/report${query}`),
    getClientAddress: () => '203.0.113.9',
    locals: { safeGetSession: async () => ({ session: null, user: null }) }
  } as never;
}

const illegal = {
  reason: 'illegal',
  url: 'https://feega.app/s/tok',
  category: 'fraud',
  explanation: 'A scam.',
  name: 'Ada',
  email: 'ada@example.com',
  good_faith: 'on'
};

const inserted = () => fake.calls.find((c) => c.table === 'content_reports' && c.op === 'insert')?.payload as Record<string, unknown> | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  fake = fakeDb({ canvases: [CANVAS], nodes: [NODE], orgs_members: [], content_reports: [] });
});

describe('/report', () => {
  it('prefills the link of the share page it came from', async () => {
    const data = (await load({ url: new URL('https://feega.app/report?share=tok&node=n-1') } as never)) as Record<string, unknown>;
    expect(data).toMatchObject({ prefillUrl: 'https://feega.app/s/tok', target: { shareToken: 'tok', nodeId: 'n-1' } });
  });

  it('saves a valid notice against the reported node and its author, then sends the receipt', async () => {
    const result = await actions.default(event(illegal));

    expect(result).toMatchObject({ success: true });
    expect(inserted()).toMatchObject({ reason: 'illegal', org_id: 'o-1', node_id: 'n-1', canvas_id: 'c-1', affected_user_id: 'u-author', priority: 1 });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ada@example.com', subject: expect.stringContaining('We received your report') }));
  });

  it('never stores the raw IP', async () => {
    await actions.default(event(illegal));
    expect(JSON.stringify(inserted())).not.toContain('203.0.113.9');
  });

  it('refuses an incomplete notice with the errors per field', async () => {
    const result = await actions.default(event({ ...illegal, good_faith: '' }));
    expect(result).toMatchObject({ status: 400, data: { errors: { good_faith: expect.any(String) } } });
    expect(inserted()).toBeUndefined();
  });

  it('a filled honeypot is accepted silently and saves nothing', async () => {
    const result = await actions.default(event({ ...illegal, website: 'http://spam' }));
    expect(result).toMatchObject({ success: true });
    expect(inserted()).toBeUndefined();
  });

  it('rate-limits a sender after five reports in an hour', async () => {
    fake = fakeDb({ canvases: [CANVAS], nodes: [NODE], content_reports: [1, 2, 3, 4, 5].map((i) => ({ id: `r-${i}` })) });
    const result = await actions.default(event(illegal));
    expect(result).toMatchObject({ status: 429 });
    expect(inserted()).toBeUndefined();
  });

  it('a CSAM report needs no identity and escalates to the internal team', async () => {
    const result = await actions.default(event({ reason: 'csam', url: 'https://feega.app/s/tok' }));

    expect(result).toMatchObject({ success: true });
    expect(inserted()).toMatchObject({ reason: 'csam', priority: 0, reporter_email: null, escalated_at: expect.any(String) });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ops@feega.app', subject: expect.stringContaining('URGENT') }));
  });

  it('a node from another canvas than the shared one is not attached', async () => {
    fake = fakeDb({ canvases: [CANVAS], nodes: [{ ...NODE, canvas_id: 'other' }], content_reports: [] });
    await actions.default(event(illegal));
    expect(inserted()).toMatchObject({ node_id: null, canvas_id: 'c-1' });
  });
});
