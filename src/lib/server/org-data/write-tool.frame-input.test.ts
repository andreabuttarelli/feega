import { describe, expect, it, vi } from 'vitest';
import { createOrgWriteTools } from './write-tool';

vi.mock('$lib/server/ai-log', () => ({ logAiCall: vi.fn() }));
vi.mock('./presence', () => ({ announcePresence: vi.fn().mockResolvedValue(undefined) }));

const FRAME_ROW = { id: 'f1', org_id: 'org-mine', project_id: 'p1', canvas_id: 'c1', type: 'motion', x: 0, y: 0, z: 0, width: null, height: null, display_name: null, data: {}, version: 1, deleted_at: null, created_at: '', updated_at: '' };

function authority(inserted: unknown[]) {
  const builder = (rows: unknown[]) => {
    const b = { eq: () => b, is: () => b, select: () => b, maybeSingle: () => Promise.resolve({ data: FRAME_ROW, error: null }), abortSignal: () => Promise.resolve({ data: rows, error: null }) };
    return b;
  };
  return {
    from: () => ({
      select: () => builder([]),
      insert: (values: Record<string, unknown>) => {
        inserted.push(values);
        return builder([{ id: 'c1', ...values }]);
      }
    })
  };
}

describe('insert_row on nodes_connections into a Frame', () => {
  it('is refused: a Frame takes no inputs', async () => {
    const inserted: unknown[] = [];
    const tools = createOrgWriteTools({ authority: { kind: 'service', supabase: authority(inserted) as never }, orgId: 'org-mine' });

    const out = await tools.insertRow({ table: 'nodes_connections', values: { canvas_id: 'c1', source_node_id: 'gen', target_node_id: 'f1' } });

    expect(out).toMatchObject({ error: 'edge_refused' });
    expect(inserted).toEqual([]);
  });
});
