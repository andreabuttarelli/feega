import { describe, it, expect } from 'vitest';
import { Detail, compactWrite, trimBlobs } from './compact-result';

const BASE64 = `data:image/png;base64,${'A'.repeat(40_000)}`;
const LONG_TEXT = 'lorem ipsum dolor sit amet '.repeat(120);
const DOC = { tracks: Array.from({ length: 40 }, (_, i) => ({ id: `t${i}`, clips: Array.from({ length: 6 }, (_, j) => ({ id: `c${i}-${j}`, start: j, duration: 2, props: { fill: '#fff', text: 'hello world' } })) })) };

const node = (data: Record<string, unknown>) => ({ id: 'n-1', org_id: 'o-1', canvas_id: 'c-1', project_id: 'p-1', type: 'text', version: 4, x: 10, y: 20, width: 320, height: 200, display_name: 'Note', data, created_at: '2026-10-24T10:00:00Z', updated_at: '2026-10-24T10:01:00Z', deleted_at: null });

const size = (v: unknown) => JSON.stringify(v).length;
const EDIT_BUDGET_CHARS = 500;

type Case = { name: string; before: unknown; touched: string[]; single: boolean };

const CASES: Case[] = [
  { name: 'insert_row text node', before: { table: 'nodes', row: node({ text: LONG_TEXT }), inserted: 1 }, touched: ['type', 'x', 'y', 'data'], single: true },
  { name: 'update_row node data', before: { table: 'nodes', rows: [node({ text: LONG_TEXT, doc: DOC })], updated: 1, matched: 1, conflicts: [], note: 'data was merged' }, touched: ['data'], single: true },
  { name: 'update_row 10 rows', before: { table: 'nodes', rows: Array.from({ length: 10 }, () => node({ text: LONG_TEXT })), updated: 10, matched: 10 }, touched: ['display_name'], single: false },
  { name: 'create_node image', before: { outcome: 'written', node: node({ src: BASE64 }) }, touched: ['type', 'x', 'y', 'data'], single: true },
  { name: 'update_node', before: { outcome: 'written', node: node({ text: LONG_TEXT, doc: DOC }) }, touched: ['data'], single: true },
  { name: 'move_node', before: { node: node({ doc: DOC }) }, touched: ['x', 'y'], single: true },
  { name: 'write_nodes x20', before: { results: Array.from({ length: 20 }, (_, i) => ({ node_id: `n-${i}`, outcome: 'written', node: node({ text: LONG_TEXT }) })) }, touched: ['data'], single: false },
  { name: 'frame set_props', before: { tool: 'set_props', version: 8, saved: true, output: { doc: DOC, ok: true } }, touched: [], single: true },
  { name: 'batch of 12 moves', before: { applied: 12, results: Array.from({ length: 12 }, (_, i) => ({ index: i, op: 'move_node', status: 200, body: { node: node({ doc: DOC }) } })) }, touched: ['x', 'y'], single: false },
  { name: 'delete_row', before: { table: 'nodes', deleted: 1, matched: 1, note: 'Gone. Nothing here restores them.' }, touched: [], single: true }
];

describe('a write answers ids and changed fields, not the whole document', () => {
  it('every typical edit answer stays under the budget, and the table of before and after is printed', () => {
    const lines = CASES.map(({ name, before, touched, single }) => ({ name, single, before: size(before), after: size(compactWrite(before, { touched })) }));
    console.table(lines.map(({ name, before, after }) => ({ name, before, after })));

    for (const line of lines.filter((l) => l.single)) {
      expect(line.after, line.name).toBeLessThan(EDIT_BUDGET_CHARS);
    }
    for (const line of lines) {
      expect(line.after, line.name).toBeLessThanOrEqual(line.before);
    }
  });

  it('keeps the id, the new version and the fields that were written', () => {
    const out = compactWrite({ outcome: 'written', node: node({ text: 'hi' }) }, { touched: ['x'] }) as { node: Record<string, unknown> };

    expect(out.node).toMatchObject({ id: 'n-1', version: 4, x: 10 });
    expect(out.node).not.toHaveProperty('created_at');
    expect(out.node).not.toHaveProperty('org_id');
  });

  it('says it trimmed, so the agent knows to ask for verbose', () => {
    const out = compactWrite({ node: node({ doc: DOC }) }, { touched: ['data'] }) as { trimmed?: boolean };

    expect(out.trimmed).toBe(true);
  });

  it('verbose returns the answer untouched', () => {
    const body = { node: node({ doc: DOC }) };

    expect(compactWrite(body, { touched: ['data'], detail: Detail.Verbose })).toBe(body);
  });

  it('a refusal keeps its message and fix whole', () => {
    const refusal = { error: 'invalid_node_data', message: LONG_TEXT.slice(0, 280), fix: 'Call describe_node_types.' };

    expect(compactWrite(refusal, { touched: [] })).toEqual(refusal);
  });
});

describe('big blobs are trimmed from any answer unless asked', () => {
  it('replaces a base64 string and a long string with their size', () => {
    const out = trimBlobs({ a: BASE64, b: LONG_TEXT, c: 'short' }) as Record<string, string>;

    expect(out.a).toMatch(/^\[\d+ chars/);
    expect(out.b).toMatch(/^\[\d+ chars/);
    expect(out.c).toBe('short');
  });

  it('keeps a long signed link whole, the agent has to use it', () => {
    const link = `https://storage.example.com/upload?token=${'t'.repeat(600)}`;

    expect((trimBlobs({ uploadUrl: link }) as { uploadUrl: string }).uploadUrl).toBe(link);
  });

  it('caps a long array and says how many are missing', () => {
    const out = trimBlobs({ items: Array.from({ length: 80 }, (_, i) => i) }) as { items: unknown[] };

    expect(out.items.length).toBeLessThan(80);
    expect(out.items.at(-1)).toMatch(/more/);
  });
});
