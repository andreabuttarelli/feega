import { describe, expect, it, vi } from 'vitest';
import { createOrgWriteTools } from './write-tool';

vi.mock('$lib/server/ai-log', () => ({ logAiCall: vi.fn() }));
vi.mock('./presence', () => ({ announcePresence: vi.fn().mockResolvedValue(undefined) }));

const written = { id: 'p-1', org_id: 'o', brand_id: 'b', canvas_id: 'c', version: 2, type: 'text', created_at: 'now', updated_at: 'now', name: 'Renamed', body: 'y'.repeat(6000) };

function tools() {
  const builder = {
    filter: () => builder,
    not: () => builder,
    limit: () => builder,
    select: () => builder,
    abortSignal: () => Promise.resolve({ data: [written], error: null, count: 1 })
  };
  const supabase = { from: () => ({ insert: () => builder, update: () => builder, delete: () => builder, select: () => builder }) } as never;
  return createOrgWriteTools({ authority: { kind: 'service', supabase }, orgId: 'o' });
}

describe('insert_row and update_row answer ids and changed fields', () => {
  it('an insert comes back as id and version, not the whole row', async () => {
    const out = await tools().insertRow({ table: 'projects', values: { name: 'Renamed' } });

    expect(JSON.stringify(out).length).toBeLessThan(500);
    expect(out).toMatchObject({ inserted: 1, row: { id: 'p-1', name: 'Renamed' } });
  });

  it('an update keeps the id and the column it wrote, and drops the rest', async () => {
    const out = (await tools().updateRow({ table: 'projects', where: [{ column: 'id', op: 'eq', value: 'p-1' }], values: { name: 'Renamed' } })) as { rows: Record<string, unknown>[] };

    expect(out.rows[0]).toMatchObject({ id: 'p-1', name: 'Renamed' });
    expect(out.rows[0]).not.toHaveProperty('body');
  });

  it('verbose gives the whole row back', async () => {
    const out = (await tools().insertRow({ table: 'projects', values: { name: 'Renamed' }, verbose: true })) as { row: Record<string, unknown> };

    expect(out.row.body).toBe(written.body);
  });
});
