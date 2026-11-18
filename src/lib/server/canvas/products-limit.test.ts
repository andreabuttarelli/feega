import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

const store = vi.hoisted(() => ({ catalogue: [] as { externalId: string }[] }));
const nodeState = vi.hoisted(() => ({ data: {} as Record<string, unknown>, version: 1 }));

vi.mock('$lib/server/store-fetch', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchStoreProductsPage: async (_p: string, _u: string, opts: { limit: number; after: string | null }) => {
    const start = opts.after ? Number(opts.after) : 0;
    const products = store.catalogue
      .slice(start, start + opts.limit)
      .map((p) => ({ ...p, handle: p.externalId, title: p.externalId, images: [] }));
    return { ok: true, products, after: String(start + products.length) };
  }
}));

vi.mock('$lib/server/repos/canvas', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findNode: async () => ({ id: 'node-1', type: 'products', version: nodeState.version, data: nodeState.data }),
  writeNodeData: async (_db: unknown, input: { data: Record<string, unknown> }) => {
    nodeState.data = input.data;
    nodeState.version += 1;
    return { outcome: 'ok', node: { id: 'node-1', data: nodeState.data } };
  },
  patchNodeData: async (_db: unknown, input: { patch: Record<string, unknown> }) => {
    nodeState.data = { ...nodeState.data, ...input.patch };
    nodeState.version += 1;
    return { outcome: 'written', node: { id: 'node-1', data: nodeState.data } };
  }
}));

import { syncNode } from './node-sync';
import { listNodeProducts } from '$lib/server/repos/products';

const ORG = 'org-1';
const NODE = 'node-1';

function fakeProductsDb() {
  let rows: Row[] = [];
  const key = (r: Row) => `${r.node_id}|${r.platform}|${r.external_id}`;

  const query = () => {
    const filters: [string, unknown][] = [];
    const matches = (r: Row) => filters.every(([k, v]) => r[k] === v);

    const deletion = {
      eq(k: string, v: unknown) {
        filters.push([k, v]);
        return deletion;
      },
      then(resolve: (v: unknown) => void) {
        rows = rows.filter((r) => !matches(r));
        resolve({ error: null });
      }
    };

    const chain = {
      eq(k: string, v: unknown) {
        filters.push([k, v]);
        return chain;
      },
      select() {
        return chain;
      },
      order() {
        return Promise.resolve({ data: rows.filter(matches), error: null });
      },
      delete() {
        return deletion;
      },
      upsert(incoming: Row[]) {
        const fresh = new Set(incoming.map(key));
        rows = rows.filter((r) => !fresh.has(key(r))).concat(incoming);
        return Promise.resolve({ error: null });
      }
    };
    return chain;
  };

  return { from: () => query() } as never;
}

const actor = { kind: 'user', id: 'user-1' } as never;

async function fetchWithLimit(db: never, limit: number): Promise<string[]> {
  nodeState.data = { ...nodeState.data, limit };
  await syncNode(db, { orgId: ORG, projectId: null, nodeId: NODE, version: nodeState.version, actor });
  const products = await listNodeProducts(db, { orgId: ORG, nodeId: NODE });
  return products.map((p) => p.externalId);
}

beforeEach(() => {
  store.catalogue = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((externalId) => ({ externalId }));
  nodeState.data = { type: 'shopify', url: 'https://shop.example.com' };
  nodeState.version = 1;
});

describe('il limite del nodo products è il totale mostrato', () => {
  it('limite 2 scaricato due volte mostra gli stessi 2, poi 3 ne mostra 3 e 1 ne mostra 1', async () => {
    const db = fakeProductsDb();

    expect(await fetchWithLimit(db, 2)).toEqual(['a', 'b']);
    expect(await fetchWithLimit(db, 2)).toEqual(['a', 'b']);
    expect(await fetchWithLimit(db, 3)).toEqual(['a', 'b', 'c']);
    expect(await fetchWithLimit(db, 1)).toEqual(['a']);
  });
});
