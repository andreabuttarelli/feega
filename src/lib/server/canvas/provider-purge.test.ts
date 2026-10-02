import { describe, expect, it, vi } from 'vitest';
import { fakeDb } from '$lib/server/db/fake-db';
import { purgeProviderCopies, type Purgers } from './provider-purge';

const NOW = new Date('2026-10-02T12:00:00Z');

function runRow(fields: Record<string, unknown>) {
  return {
    id: 'run-1',
    org_id: 'org-1',
    node_id: 'node-1',
    prompt: null,
    model: null,
    params: {},
    status: 'done',
    error: null,
    output_asset_id: 'asset-1',
    external_job_id: 'wiro:42',
    cost_usd: null,
    attempts: 0,
    actor_id: null,
    started_at: '2026-10-02T11:00:00Z',
    finished_at: '2026-10-02T11:30:00Z',
    provider_purged_at: null,
    ...fields
  };
}

function purgedUpdates(calls: ReturnType<typeof fakeDb>['calls']) {
  return calls.filter((c) => c.table === 'node_runs' && c.op === 'update');
}

describe('purgeProviderCopies', () => {
  it('asks the provider to delete a landed run, then records it with its org', async () => {
    const purge = vi.fn(async () => 'purged' as const);
    const { db, calls } = fakeDb({ node_runs: [runRow({})] });

    const out = await purgeProviderCopies(db, { 'wiro:': purge }, { now: NOW });

    expect(purge).toHaveBeenCalledWith('wiro:42');
    expect(out).toEqual({ purged: 1, waiting: 0, failed: 0 });
    const [update] = purgedUpdates(calls);
    expect(update.payload).toEqual({ provider_purged_at: NOW.toISOString() });
    expect(update.filters).toEqual(expect.arrayContaining([['id', 'run-1'], ['org_id', 'org-1']]));
  });

  it('only reads finished runs not yet purged, within the retry window', async () => {
    const { db, calls } = fakeDb({ node_runs: [] });

    await purgeProviderCopies(db, { 'wiro:': vi.fn() }, { now: NOW });

    const [select] = calls.filter((c) => c.table === 'node_runs' && c.op === 'select');
    expect(select.filters).toEqual(
      expect.arrayContaining([
        ['status', ['done', 'failed', 'expired']],
        ['provider_purged_at', null],
        ['finished_at', '2026-09-25T12:00:00.000Z']
      ])
    );
  });

  it('never touches a run still running: our copy does not exist yet', async () => {
    const purge = vi.fn(async () => 'purged' as const);
    const { db } = fakeDb({ node_runs: [runRow({ status: 'running', output_asset_id: null, finished_at: null })] }, { filter: true });

    await purgeProviderCopies(db, { 'wiro:': purge }, { now: NOW });

    expect(purge).not.toHaveBeenCalled();
  });

  it('leaves a run unmarked while the provider is not ready, so the next tick retries', async () => {
    const { db, calls } = fakeDb({ node_runs: [runRow({})] });

    const out = await purgeProviderCopies(db, { 'wiro:': async () => 'not_ready' }, { now: NOW });

    expect(out).toEqual({ purged: 0, waiting: 1, failed: 0 });
    expect(purgedUpdates(calls)).toHaveLength(0);
  });

  it('a failed delete is left for the next tick and does not stop the others', async () => {
    const purgers: Purgers = {
      'wiro:': async (jobId) => {
        if (jobId === 'wiro:1') {
          throw new Error('wiro_failed: HTTP 500');
        }
        return 'purged';
      }
    };
    const rows = [runRow({ id: 'a', external_job_id: 'wiro:1' }), runRow({ id: 'b', external_job_id: 'wiro:2' })];
    const { db, calls } = fakeDb({ node_runs: rows });

    const out = await purgeProviderCopies(db, purgers, { now: NOW });

    expect(out).toEqual({ purged: 1, waiting: 0, failed: 1 });
    expect(purgedUpdates(calls).map((c) => c.filters.find(([k]) => k === 'id')?.[1])).toEqual(['b']);
  });

  it('hands each run only to the purger of its own provider', async () => {
    const wiro = vi.fn(async () => 'purged' as const);
    const dubbing = vi.fn(async () => 'purged' as const);
    const { db } = fakeDb({ node_runs: [runRow({ external_job_id: 'elevenlabs:dubbing:d1:it' })] });

    await purgeProviderCopies(db, { 'wiro:': wiro, 'elevenlabs:': dubbing }, { now: NOW });

    expect(dubbing).toHaveBeenCalledWith('elevenlabs:dubbing:d1:it');
    expect(wiro).not.toHaveBeenCalled();
  });
});
