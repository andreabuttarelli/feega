import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, type FakeDb } from '$lib/server/db/fake-db';
import { hashToken } from '$lib/server/reports/reports';

const sendEmail = vi.fn(async (_m: { to: string; subject: string; text?: string }) => {});
let fake: FakeDb;

vi.mock('$lib/server/db/client', () => ({ createServiceRoleDb: () => fake.db }));
vi.mock('$lib/server/email', () => ({ sendEmail: (m: { to: string; subject: string }) => sendEmail(m) }));
vi.mock('$lib/server/internal-users', () => ({ internalEmails: () => [] }));

import { actions } from './+page.server';

const TOKEN = 'secret-token';

const REPORT = {
  id: 'r-1',
  target_url: 'https://feega.app/s/tok',
  reason: 'copyright',
  details: {},
  reporter_email: 'ada@example.com',
  status: 'actioned',
  counter_token_hash: hashToken(TOKEN)
};

const COUNTER = {
  name: 'Bob Rossi',
  email: 'bob@example.com',
  address: 'Via Roma 1, Rome',
  material: 'My image node',
  statement: 'It is my own photo.',
  perjury: 'on',
  consent: 'on',
  signature: 'Bob Rossi'
};

function event(fields: Record<string, string>, token = TOKEN) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    body.set(k, v);
  }
  return {
    params: { id: 'r-1' },
    request: new Request('https://feega.app/report/counter/r-1', { method: 'POST', body }),
    url: new URL(`https://feega.app/report/counter/r-1?t=${token}`)
  } as never;
}

const update = () => fake.calls.find((c) => c.table === 'content_reports' && c.op === 'update')?.payload as Record<string, unknown> | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  fake = fakeDb({ content_reports: [REPORT] });
});

describe('/report/counter/[id]', () => {
  it('a valid counter-notice starts the 10-business-day timer and is forwarded to the claimant', async () => {
    const result = await actions.default(event(COUNTER));

    expect(result).toMatchObject({ success: true });
    expect(update()).toMatchObject({ status: 'counter_noticed', restore_after: expect.any(String), counter_notice: expect.objectContaining({ name: 'Bob Rossi' }) });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'ada@example.com', subject: expect.stringContaining('Counter-notice') }));
  });

  it('a wrong token is refused', async () => {
    const result = await actions.default(event(COUNTER, 'guess'));
    expect(result).toMatchObject({ status: 400 });
    expect(update()).toBeUndefined();
  });

  it('a counter-notice missing the perjury statement is refused', async () => {
    const result = await actions.default(event({ ...COUNTER, perjury: '' }));
    expect(result).toMatchObject({ status: 400, data: { errors: { perjury: expect.any(String) } } });
  });

  it('cannot be filed twice', async () => {
    fake = fakeDb({ content_reports: [{ ...REPORT, status: 'counter_noticed' }] });
    const result = await actions.default(event(COUNTER));
    expect(result).toMatchObject({ status: 400 });
  });
});
