import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Remote } from '$lib/canvas/staleness';

const findCanvasForUser = vi.fn();
const findProjectForUser = vi.fn();

vi.mock('$lib/server/canvas/lookup', () => ({ findCanvasForUser: (...a: unknown[]) => findCanvasForUser(...a) }));
vi.mock('$lib/server/projects/lookup', () => ({ findProjectForUser: (...a: unknown[]) => findProjectForUser(...a) }));

import { canvasRevision, recordsRevision, revisionOf } from './revision';

function fakeDb(rows: Record<string, unknown[]>) {
  return {
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        then: (resolve: (value: unknown) => void) => resolve({ data: rows[table] ?? [], error: null })
      };
      return query;
    }
  };
}

const input = { canvasId: 'c1', projectId: 'p1', memberships: [] };

beforeEach(() => {
  findCanvasForUser.mockReset();
  findProjectForUser.mockReset();
});

describe('revisionOf', () => {
  const node = { id: 'a', version: 1, x: 0, y: 0, width: 10, height: 10 };

  it('non dipende dall\'ordine delle righe', () => {
    const b = { ...node, id: 'b' };
    expect(revisionOf([node, b], [{ id: 'e' }])).toBe(revisionOf([b, node], [{ id: 'e' }]));
  });

  it('cambia con una versione, uno spostamento, un nodo o un arco in più', () => {
    const base = revisionOf([node], []);
    expect(revisionOf([{ ...node, version: 2 }], [])).not.toBe(base);
    expect(revisionOf([{ ...node, x: 5 }], [])).not.toBe(base);
    expect(revisionOf([node, { ...node, id: 'b' }], [])).not.toBe(base);
    expect(revisionOf([node], [{ id: 'e' }])).not.toBe(base);
  });
});

describe('recordsRevision', () => {
  it('la revisione del caricamento è la stessa che il controllo leggerà dopo', () => {
    const record = { id: 'a', canvasId: 'c1', projectId: 'p1', type: 'text', displayName: null, position: { x: 1, y: 2, z: 0 }, size: { width: 10, height: 20 }, data: {}, version: 3 };
    const edge = { id: 'e', canvasId: 'c1', sourceNodeId: 'a', targetNodeId: 'a', sourceHandle: null, targetHandle: null, mode: null };

    expect(recordsRevision([record], [edge as never])).toBe(revisionOf([{ id: 'a', version: 3, x: 1, y: 2, width: 10, height: 20 }], [{ id: 'e' }]));
  });
});

describe('canvasRevision', () => {
  it('una tela viva restituisce la revisione delle sue righe', async () => {
    findCanvasForUser.mockResolvedValue({ orgId: 'o1', canvas: { id: 'c1' } });
    const nodes = [{ id: 'a', version: 1, x: 0, y: 0, width: 10, height: 10 }];
    const db = fakeDb({ nodes, nodes_connections: [] });

    expect(await canvasRevision(db as never, input)).toEqual({ kind: Remote.Live, revision: revisionOf(nodes, []) });
  });

  it('tela sparita in un progetto vivo: CanvasGone', async () => {
    findCanvasForUser.mockResolvedValue(null);
    findProjectForUser.mockResolvedValue({ orgId: 'o1', project: { id: 'p1' } });

    expect(await canvasRevision(fakeDb({}) as never, input)).toEqual({ kind: Remote.CanvasGone });
  });

  it('progetto sparito: ProjectGone', async () => {
    findCanvasForUser.mockResolvedValue(null);
    findProjectForUser.mockResolvedValue(null);

    expect(await canvasRevision(fakeDb({}) as never, input)).toEqual({ kind: Remote.ProjectGone });
  });
});
