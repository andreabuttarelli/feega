import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { decideReport, restoreDueReports, type ReportDeps } from './reports';

const NOW = new Date('2026-10-20T12:00:00Z');

function deps(rows: Record<string, unknown[]>) {
  const fake = fakeDb(rows);
  const d: ReportDeps = {
    db: fake.db,
    send: vi.fn(async () => {}),
    ban: vi.fn(async () => {}),
    move: vi.fn(async () => {}),
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

describe('removing content kills the links already handed out', () => {
  const report = { id: 'r-1', org_id: 'o-1', node_id: 'n-1', canvas_id: null, affected_user_id: null, reason: 'illegal', target_url: 'https://x', details: {}, status: 'open' };
  const node = { id: 'n-1', org_id: 'o-1', data: { assetId: 'a-1' } };
  const asset = () => ({ id: 'a-1', org_id: 'o-1', url: 'o-1/p/file.png', source: 'upload' });

  function world(stored: ReturnType<typeof asset>) {
    const fake = fakeDb({ content_reports: [report], nodes: [node], node_runs: [], assets: [stored], profiles: [] }, { filter: true, mutate: true });
    const d: ReportDeps = { ...deps({}).d, db: fake.db };
    return d;
  }

  it('a removal moves the node files into quarantine under the report', async () => {
    const stored = asset();
    const d = world(stored);

    await decideReport(d, { reportId: 'r-1', decision: 'remove', ground: 'illegal', note: 'facts', decidedBy: 'admin' });

    expect(d.move).toHaveBeenCalledWith({ bucket: 'canvas-assets', path: 'o-1/p/file.png' }, { bucket: 'quarantine', path: 'o-1/r-1/o-1/p/file.png' });
    expect(stored.url).toBe('o-1/r-1/o-1/p/file.png');
  });

  it('a restore moves them back', async () => {
    const stored = { ...asset(), url: 'o-1/r-1/o-1/p/file.png' };
    const d = world(stored);

    await decideReport(d, { reportId: 'r-1', decision: 'restore', ground: 'reversed', note: 'facts', decidedBy: 'admin' });

    expect(d.move).toHaveBeenCalledWith({ bucket: 'quarantine', path: 'o-1/r-1/o-1/p/file.png' }, { bucket: 'canvas-assets', path: 'o-1/p/file.png' });
    expect(stored.url).toBe('o-1/p/file.png');
  });

  it('a dismissal moves nothing', async () => {
    const d = world(asset());

    await decideReport(d, { reportId: 'r-1', decision: 'dismiss', ground: 'no_violation', note: 'facts', decidedBy: 'admin' });

    expect(d.move).not.toHaveBeenCalled();
  });
});
