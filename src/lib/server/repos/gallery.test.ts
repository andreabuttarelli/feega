import { describe, expect, it } from 'vitest';
import type { Db } from '$lib/server/db/client';
import { listGallery } from './gallery';

function recordingDb(selects: string[]): Db {
  const chain: Record<string, unknown> = {};
  for (const m of ['eq', 'gt', 'lte', 'or', 'contains', 'order', 'limit', 'range', 'ilike']) {
    chain[m] = () => chain;
  }
  chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
  return { from: () => ({ select: (cols: string) => { selects.push(cols); return chain; } }) } as unknown as Db;
}

describe('gallery repo', () => {
  it('embeds the origin by the remixed_from column, the hint PostgREST resolves on a self-join', async () => {
    const selects: string[] = [];
    await listGallery(recordingDb(selects), {});

    expect(selects[0]).toContain('origin:gallery_items!remixed_from(');
  });
});
