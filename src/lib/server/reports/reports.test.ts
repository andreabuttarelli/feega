import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { restoreDueReports, type ReportDeps } from './reports';

const NOW = new Date('2026-10-20T12:00:00Z');

function deps(rows: Record<string, unknown[]>) {
  const fake = fakeDb(rows);
  const d: ReportDeps = {
    db: fake.db,
    send: vi.fn(async () => {}),
    ban: vi.fn(async () => {}),
    now: () => NOW,
    internalRecipients: () => [],
    origin: 'https://feega.app'
  };
  return { d, fake };
}

describe('the counter-notice timer', () => {
  it('asks only for due reports with no suit filed', async () => {
    const { d, fake } = deps({ content_reports: [] });
    await restoreDueReports(d);

    const query = fake.calls.find((c) => c.table === 'content_reports' && c.op === 'select')!;
    expect(query.filters).toEqual([
      ['status', 'counter_noticed'],
      ['suit_filed_at', null],
      ['restore_after', NOW.toISOString()]
    ]);
  });

  it('restores a due report as a counter-notice decision, not by a person', async () => {
    const row = { id: 'r-1', node_id: 'n-1', canvas_id: null, affected_user_id: 'u-1', reason: 'copyright', target_url: 'https://x', details: {}, status: 'counter_noticed' };
    const { d, fake } = deps({ content_reports: [row], account_strikes: [], profiles: [] });

    expect(await restoreDueReports(d)).toEqual({ restored: 1 });
    const update = fake.calls.find((c) => c.table === 'content_reports' && c.op === 'update')!.payload;
    expect(update).toMatchObject({ status: 'restored', ground: 'counter_notice', decided_by: null });
    expect(fake.calls.find((c) => c.table === 'nodes')?.payload).toMatchObject({ deleted_at: null });
  });
});
