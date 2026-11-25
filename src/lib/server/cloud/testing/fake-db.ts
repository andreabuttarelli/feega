import type { SupabaseClient } from '@supabase/supabase-js';

export type Row = Record<string, unknown>;

type Result = { data: unknown; error: { code?: string; message: string } | null };
type Predicate = (row: Row) => boolean;
type Action = 'select' | 'insert' | 'update' | 'upsert' | 'delete';

const UNIQUE_VIOLATION = '23505';

export type FakeDb = SupabaseClient & {
  tables: Record<string, Row[]>;
  uploads: string[];
};

type Options = { unique?: Record<string, string[]> };

function defaults(row: Row): Row {
  return { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row };
}

export function fakeDb(seed: Record<string, Row[]> = {}, options: Options = {}): FakeDb {
  const tables: Record<string, Row[]> = Object.fromEntries(Object.entries(seed).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))]));
  const uploads: string[] = [];

  function query(table: string) {
    const rows = () => (tables[table] ??= []);
    const predicates: Predicate[] = [];
    let action: Action = 'select';
    let payload: Row[] = [];
    let ignoreDuplicates = false;
    let orderBy: { column: string; ascending: boolean } | null = null;
    let max = Infinity;

    const duplicate = (row: Row) => {
      const columns = options.unique?.[table];
      return columns ? rows().find((other) => columns.every((column) => other[column] === row[column])) : undefined;
    };

    const run = (): Result => {
      if (action === 'insert' || action === 'upsert') {
        const inserted: Row[] = [];
        for (const row of payload.map(defaults)) {
          const existing = duplicate(row);
          if (existing) {
            if (action === 'upsert') {
              if (!ignoreDuplicates) {
                Object.assign(existing, row);
              }
              continue;
            }
            return { data: null, error: { code: UNIQUE_VIOLATION, message: 'duplicate key' } };
          }
          rows().push(row);
          inserted.push(row);
        }
        return { data: inserted, error: null };
      }

      const matched = rows().filter((row) => predicates.every((test) => test(row)));
      if (action === 'update') {
        matched.forEach((row) => Object.assign(row, payload[0]));
      }
      if (action === 'delete') {
        tables[table] = rows().filter((row) => !matched.includes(row));
      }
      if (orderBy) {
        const { column, ascending } = orderBy;
        matched.sort((a, b) => (String(a[column]) < String(b[column]) ? -1 : 1) * (ascending ? 1 : -1));
      }
      return { data: matched.slice(0, max).map((row) => ({ ...row })), error: null };
    };

    const builder: Record<string, unknown> = {
      select: () => builder,
      insert: (value: Row | Row[]) => {
        action = 'insert';
        payload = Array.isArray(value) ? value : [value];
        return builder;
      },
      upsert: (value: Row | Row[], opts?: { ignoreDuplicates?: boolean }) => {
        action = 'upsert';
        ignoreDuplicates = Boolean(opts?.ignoreDuplicates);
        payload = Array.isArray(value) ? value : [value];
        return builder;
      },
      update: (value: Row) => {
        action = 'update';
        payload = [value];
        return builder;
      },
      delete: () => {
        action = 'delete';
        return builder;
      },
      eq: (column: string, value: unknown) => (predicates.push((row) => row[column] === value), builder),
      neq: (column: string, value: unknown) => (predicates.push((row) => row[column] !== value), builder),
      in: (column: string, values: unknown[]) => (predicates.push((row) => values.includes(row[column])), builder),
      is: (column: string, value: unknown) => (predicates.push((row) => (row[column] ?? null) === value), builder),
      gte: (column: string, value: string) => (predicates.push((row) => String(row[column]) >= value), builder),
      lt: (column: string, value: string) => (predicates.push((row) => String(row[column]) < value), builder),
      order: (column: string, opts?: { ascending?: boolean }) => ((orderBy = { column, ascending: opts?.ascending ?? true }), builder),
      limit: (count: number) => ((max = count), builder),
      maybeSingle: async () => {
        const result = run();
        return { ...result, data: (result.data as Row[] | null)?.[0] ?? null };
      },
      single: async () => {
        const result = run();
        const first = (result.data as Row[] | null)?.[0];
        return first || result.error ? { ...result, data: first ?? null } : { data: null, error: { message: 'no rows' } };
      },
      then: (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject)
    };

    return builder;
  }

  const storage = {
    from: (bucket: string) => ({
      createSignedUploadUrl: async (path: string) => {
        uploads.push(`${bucket}/${path}`);
        return { data: { signedUrl: `https://storage.test/upload/${bucket}/${path}?token=t`, token: 't', path }, error: null };
      }
    })
  };

  return { from: query, storage, tables, uploads } as unknown as FakeDb;
}
