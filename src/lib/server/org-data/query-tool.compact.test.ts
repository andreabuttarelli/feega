import { describe, expect, it, vi } from 'vitest';
import { createOrgQueryTool } from './query-tool';

vi.mock('$lib/server/ai-log', () => ({ logAiCall: vi.fn() }));

type Row = Record<string, unknown>;

function authority(rows: Row[], count: number) {
  const ranges: Array<[number, number]> = [];
  const builder = {
    filter: () => builder,
    not: () => builder,
    order: () => builder,
    range: (from: number, to: number) => (ranges.push([from, to]), builder),
    abortSignal: () => Promise.resolve({ data: rows, error: null, count })
  };
  const supabase = { from: () => ({ select: () => builder }) } as never;
  return { ranges, supabase };
}

const read = (supabase: never, input: Record<string, unknown>) =>
  (createOrgQueryTool({ authority: { kind: 'service', supabase }, orgId: 'org-mine' }).query as unknown as { execute: (i: unknown, o: unknown) => Promise<Row> }).execute(input, {});

const heavyRows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `n-${i}`, data: { text: 'x'.repeat(3000) } }));

describe('a list weighs little: small page, cut values, a cursor to go on', () => {
  it('without limit it reads 10 and hands back a cursor that resumes where it stopped', async () => {
    const { ranges, supabase } = authority(heavyRows(10), 25);

    const out = await read(supabase, { table: 'nodes' });
    await read(supabase, { table: 'nodes', cursor: out.next_cursor });

    expect(ranges[0]).toEqual([0, 9]);
    expect(out.next_cursor).toBeTruthy();
    expect(ranges[1][0]).toBe(out.returned);
  });

  it('a big value comes back cut, and verbose lets it through longer', async () => {
    const { supabase } = authority(heavyRows(3), 3);

    const compact = await read(supabase, { table: 'nodes' });
    const verbose = await read(supabase, { table: 'nodes', verbose: true });

    expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(verbose).length);
    expect(JSON.stringify(compact).length).toBeLessThan(3_000);
  });

  it('the last page has no cursor', async () => {
    const { supabase } = authority([{ id: 'a' }, { id: 'b' }], 2);

    expect((await read(supabase, { table: 'nodes' })).next_cursor).toBeUndefined();
  });
});
