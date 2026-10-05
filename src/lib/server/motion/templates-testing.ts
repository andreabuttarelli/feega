import { expect } from 'vitest';
import type { Db } from '$lib/server/db/client';

type Row = Record<string, unknown>;

export function templatesDb(seed: Row[] = []) {
  const rows: Row[] = [...seed];
  let n = 0;

  const filtered = (filters: [string, unknown][]) => rows.filter((r) => filters.every(([c, v]) => r[c] === v));

  const db = {
    from: (table: string) => {
      expect(table).toBe('motion_templates');
      return {
        select: () => {
          const filters: [string, unknown][] = [];
          const chain = {
            eq: (c: string, v: unknown) => (filters.push([c, v]), chain),
            order: async () => ({ data: filtered(filters), error: null })
          };
          return chain;
        },
        insert: (row: Row) => {
          const stored = { ...row, id: `t${++n}` };
          rows.push(stored);
          return { select: () => ({ single: async () => ({ data: { id: stored.id }, error: null }) }) };
        },
        delete: () => {
          const filters: [string, unknown][] = [];
          const chain = {
            eq: (c: string, v: unknown) => (filters.push([c, v]), chain),
            select: async () => {
              const hit = filtered(filters);
              hit.forEach((r) => rows.splice(rows.indexOf(r), 1));
              return { data: hit.map((r) => ({ id: r.id })), error: null };
            }
          };
          return chain;
        }
      };
    }
  } as unknown as Db;

  return { db, rows };
}

