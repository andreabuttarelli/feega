import { describe, expect, it } from 'vitest';
import type { Db } from '$lib/server/db/client';
import { listRecentCanvases } from './dashboard';
import { listProjects } from './projects';

type Call = { select: string; order: string[] };

function fakeDb(rows: Record<string, unknown>[]) {
  const call: Call = { select: '', order: [] };
  const chain = {
    select(columns: string) {
      call.select = columns;
      return chain;
    },
    eq: () => chain,
    is: () => chain,
    limit: () => chain,
    order(column: string) {
      call.order.push(column);
      return chain;
    },
    then(resolve: (r: { data: unknown; error: null }) => void) {
      resolve({ data: rows, error: null });
    }
  };
  return { db: { from: () => chain } as unknown as Db, call };
}

const row = { id: 'b', project_id: 'p', name: 'B', slug: 'b', brand_id: null, archived_at: null, mode: 'standard', updated_at: '2026-01-01T00:00:00Z', last_edited_at: '2026-10-15T10:00:00Z' };

describe('le liste recenti seguono l’ultima modifica, non la nascita', () => {
  it('una tela modificata sale in cima ai recenti', async () => {
    const { db, call } = fakeDb([row]);

    const [canvas] = await listRecentCanvases(db, { orgId: 'o', limit: 12 });

    expect(call.order).toEqual(['last_edited_at']);
    expect(canvas.updatedAt).toBe(row.last_edited_at);
  });

  it('il progetto legge last_edited_at con una query sola, senza scaricare i nodi', async () => {
    const { db, call } = fakeDb([row]);

    const [project] = await listProjects(db, 'o');

    expect(call.select).not.toContain('nodes(');
    expect(call.order).toEqual(['last_edited_at']);
    expect(project.lastActiveAt).toBe(row.last_edited_at);
  });
});
