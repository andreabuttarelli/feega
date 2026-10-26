export type Row = Record<string, unknown>;
export type Tables = Map<string, Row[]>;

export enum ChangeKind {
  Insert = 'INSERT',
  Update = 'UPDATE',
  Delete = 'DELETE'
}

export type Change = { schema: 'public'; table: string; eventType: ChangeKind; new: Row; old: Row; commit_timestamp: string; errors: null };

export type Blobs = Map<string, { bytes: Uint8Array; contentType: string }>;

export type MemoryDbOptions = {
  tables: Tables;
  blobs: Blobs;
  user: { id: string; email: string; created_at: string };
  storageUrl: (bucket: string, path: string) => string;
  onChange: (change: Change) => void;
};

type DbError = { message: string; code: string; details: string | null; hint: string | null };
type Result = { data: unknown; error: DbError | null; count: number | null; status: number; statusText: string };
type Filter = (row: Row) => boolean;

const UNIQUE_VIOLATION = '23505';
const NO_ROWS = 'PGRST116';
const FUNCTION_MISSING = 'PGRST202';
const HTTP_OK = 200;
const HTTP_CREATED = 201;

const UNIQUE_KEYS: Record<string, string[][]> = {
  motion_revisions: [['node_id', 'version']]
};

const FOREIGN_KEYS: Record<string, string> = {
  'orgs_members.profiles': 'user_id'
};

const DEFAULTS: Record<string, Row> = {
  nodes: { version: 1, z: 0, data: {}, display_name: null, width: null, height: null, deleted_at: null },
  nodes_connections: { mode: 'fixed', source_handle: null, target_handle: null, deleted_at: null },
  canvases: { viewport: null, deleted_at: null },
  motion_revisions: { sealed: false, summary: null }
};

const LOCAL_FUNCTIONS: Record<string, unknown> = {
  org_credit_balance: 0
};

const dbError = (code: string, message: string): DbError => ({ message, code, details: null, hint: null });

function splitTop(text: string, separator = ','): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === '(') {
      depth++;
    }
    if (char === ')') {
      depth--;
    }
    if (char === separator && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}

function read(row: Row, column: string): unknown {
  const path = column.split(/->>?/);
  return path.slice(1).reduce<unknown>((value, key) => (value && typeof value === 'object' ? (value as Row)[key] : undefined), row[path[0]]);
}

function scalar(raw: string): unknown {
  if (raw === 'null') {
    return null;
  }
  if (raw === 'true' || raw === 'false') {
    return raw === 'true';
  }
  return raw.replace(/^"(.*)"$/, '$1');
}

const comparable = (value: unknown) => (typeof value === 'number' ? value : value === null || value === undefined ? value : String(value));

function same(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' || typeof b === 'number') {
    return Number(a) === Number(b);
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return String(a) === String(b);
  }
  return (a ?? null) === (b ?? null) || (a !== null && b !== null && a !== undefined && b !== undefined && String(a) === String(b));
}

function order(a: unknown, b: unknown): number {
  const x = comparable(a);
  const y = comparable(b);
  if (x === y) {
    return 0;
  }
  if (x === null || x === undefined) {
    return 1;
  }
  if (y === null || y === undefined) {
    return -1;
  }
  return x < y ? -1 : 1;
}

function contains(have: unknown, want: unknown): boolean {
  if (Array.isArray(want)) {
    return Array.isArray(have) && want.every((w) => have.some((h) => contains(h, w)));
  }
  if (want && typeof want === 'object') {
    return !!have && typeof have === 'object' && Object.entries(want).every(([k, v]) => contains((have as Row)[k], v));
  }
  return same(have, want);
}

function likeRegex(pattern: string, flags: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${escaped}$`, flags);
}

const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : String(value).replace(/^\((.*)\)$/, '$1').split(',').map((v) => scalar(v.trim())));

const OPERATORS: Record<string, (have: unknown, want: unknown) => boolean> = {
  eq: same,
  neq: (h, w) => !same(h, w),
  gt: (h, w) => h !== null && h !== undefined && order(h, w) > 0,
  gte: (h, w) => h !== null && h !== undefined && order(h, w) >= 0,
  lt: (h, w) => h !== null && h !== undefined && order(h, w) < 0,
  lte: (h, w) => h !== null && h !== undefined && order(h, w) <= 0,
  is: (h, w) => (w === null ? h === null || h === undefined : same(h, w)),
  in: (h, w) => listOf(w).some((v) => same(h, v)),
  like: (h, w) => typeof h === 'string' && likeRegex(String(w), '').test(h),
  ilike: (h, w) => typeof h === 'string' && likeRegex(String(w), 'i').test(h),
  cs: (h, w) => contains(h, typeof w === 'string' ? JSON.parse(w.replace(/^\{(.*)\}$/, '[$1]')) : w),
  cd: (h, w) => contains(w, h),
  ov: (h, w) => Array.isArray(h) && listOf(w).some((v) => h.some((x) => same(x, v))),
  fts: () => true,
  plfts: () => true,
  wfts: () => true
};

function condition(column: string, op: string, value: unknown): Filter {
  const test = OPERATORS[op] ?? (() => true);
  return (row) => test(read(row, column), value);
}

function parseLogic(text: string): Filter {
  const parts = splitTop(text);
  const filters = parts.map((part) => {
    const group = /^(not\.)?(and|or)\((.*)\)$/.exec(part);
    if (group) {
      const children = splitTop(group[3]).map(parseLogic);
      const combined: Filter = group[2] === 'and' ? (row) => children.every((f) => f(row)) : (row) => children.some((f) => f(row));
      return group[1] ? (row: Row) => !combined(row) : combined;
    }
    const [column, ...rest] = part.split('.');
    const negated = rest[0] === 'not';
    const [op, ...value] = negated ? rest.slice(1) : rest;
    const single = condition(column, op, scalar(value.join('.')));
    return negated ? (row: Row) => !single(row) : single;
  });
  return (row) => filters.some((f) => f(row));
}

function singular(table: string): string {
  return table.replace(/ies$/, 'y').replace(/s$/, '');
}

export function createMemoryDb(options: MemoryDbOptions) {
  const { tables, blobs } = options;
  const now = () => new Date().toISOString();
  const rows = (table: string): Row[] => {
    const found = tables.get(table);
    if (found) {
      return found;
    }
    const created: Row[] = [];
    tables.set(table, created);
    return created;
  };

  function embed(table: string, row: Row, spec: string): [string, unknown] {
    const match = /^(?:(\w+):)?(\w+)(?:!(\w+))?\((.*)\)$/s.exec(spec)!;
    const [, alias, target, hint, inner] = match;
    const key = alias ?? target;
    const foreign = hint && hint !== 'inner' && hint !== 'left' ? hint : FOREIGN_KEYS[`${table}.${target}`] ?? `${singular(target)}_id`;
    if (row[foreign] !== undefined) {
      const parent = rows(target).find((r) => same(r.id, row[foreign]));
      return [key, parent ? project(target, parent, inner) : null];
    }
    const back = `${singular(table)}_id`;
    return [key, rows(target).filter((r) => same(r[back], row.id)).map((r) => project(target, r, inner))];
  }

  function project(table: string, row: Row, columns: string): Row {
    const out: Row = {};
    for (const spec of splitTop(columns || '*')) {
      if (spec === '*') {
        Object.assign(out, structuredClone(row));
        continue;
      }
      if (spec.includes('(')) {
        const [key, value] = embed(table, row, spec);
        out[key] = value;
        continue;
      }
      const [alias, column] = spec.includes(':') && !spec.includes('::') ? spec.split(':') : [null, spec];
      const name = column.replace(/::\w+$/, '');
      out[alias ?? name.split(/->>?/).pop()!] = structuredClone(read(row, name) ?? null);
    }
    return out;
  }

  function query(table: string) {
    const filters: Filter[] = [];
    const sorts: { column: string; ascending: boolean }[] = [];
    let action: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
    let payload: Row[] = [];
    let patch: Row = {};
    let columns: string | null = null;
    let returning = false;
    let counting = false;
    let headOnly = false;
    let limit: number | null = null;
    let offset = 0;
    let cardinality: 'many' | 'single' | 'maybe' = 'many';
    let conflictKeys: string[] = ['id'];
    let ignoreDuplicates = false;

    const filter = (f: Filter) => {
      filters.push(f);
      return builder;
    };

    const matching = () => rows(table).filter((row) => filters.every((f) => f(row)));

    function duplicateOf(row: Row, keys: string[][]): Row | undefined {
      return rows(table).find((r) => r !== row && keys.some((k) => k.every((c) => row[c] !== undefined && same(r[c], row[c]))));
    }

    function fill(row: Row): Row {
      return { ...DEFAULTS[table], id: crypto.randomUUID(), created_at: now(), updated_at: now(), ...structuredClone(row) };
    }

    function emit(eventType: ChangeKind, next: Row, old: Row) {
      options.onChange({ schema: 'public', table, eventType, new: structuredClone(next), old: structuredClone(old), commit_timestamp: now(), errors: null });
    }

    function write(): { rows: Row[]; error: DbError | null } {
      const keys = [['id'], ...(UNIQUE_KEYS[table] ?? [])];
      if (action === 'insert' || action === 'upsert') {
        const written: Row[] = [];
        for (const raw of payload) {
          const row = fill(raw);
          const existing = action === 'upsert' ? duplicateOf(row, [conflictKeys]) : undefined;
          if (existing) {
            if (!ignoreDuplicates) {
              const old = structuredClone(existing);
              Object.assign(existing, structuredClone(raw), { updated_at: now() });
              emit(ChangeKind.Update, existing, old);
              written.push(existing);
            }
            continue;
          }
          if (duplicateOf(row, keys)) {
            return { rows: written, error: dbError(UNIQUE_VIOLATION, `duplicate key value violates unique constraint on ${table}`) };
          }
          rows(table).push(row);
          emit(ChangeKind.Insert, row, {});
          written.push(row);
        }
        return { rows: written, error: null };
      }
      const hit = matching();
      if (action === 'update') {
        for (const row of hit) {
          const old = structuredClone(row);
          Object.assign(row, structuredClone(patch));
          emit(ChangeKind.Update, row, old);
        }
        return { rows: hit, error: null };
      }
      const kept = rows(table).filter((row) => !hit.includes(row));
      tables.set(table, kept);
      hit.forEach((row) => emit(ChangeKind.Delete, {}, row));
      return { rows: hit, error: null };
    }

    function sorted(list: Row[]): Row[] {
      return [...list].sort((a, b) => {
        for (const sort of sorts) {
          const diff = order(read(a, sort.column), read(b, sort.column));
          if (diff) {
            return sort.ascending ? diff : -diff;
          }
        }
        return 0;
      });
    }

    function shaped(list: Row[], count: number | null, created: boolean): Result {
      const status = created ? HTTP_CREATED : HTTP_OK;
      const data = list.map((row) => project(table, row, columns ?? '*'));
      if (cardinality === 'many') {
        return { data: headOnly ? null : data, error: null, count, status, statusText: 'OK' };
      }
      if (data.length > 1 || (cardinality === 'single' && data.length === 0)) {
        return { data: null, error: dbError(NO_ROWS, `JSON object requested, ${data.length} rows returned`), count, status: 406, statusText: 'Not Acceptable' };
      }
      return { data: data[0] ?? null, error: null, count, status, statusText: 'OK' };
    }

    function run(): Result {
      if (action === 'select') {
        const all = sorted(matching());
        const page = all.slice(offset, limit === null ? undefined : offset + limit);
        return shaped(page, counting ? all.length : null, false);
      }
      const { rows: written, error } = write();
      if (error) {
        return { data: null, error, count: null, status: 409, statusText: 'Conflict' };
      }
      return returning ? shaped(written, counting ? written.length : null, action !== 'update') : { data: null, error: null, count: counting ? written.length : null, status: HTTP_OK, statusText: 'OK' };
    }

    const builder = {
      select(cols?: string, opts?: { count?: string; head?: boolean }) {
        columns = cols ?? '*';
        returning = action !== 'select';
        counting = !!opts?.count;
        headOnly = !!opts?.head;
        return builder;
      },
      insert(values: Row | Row[]) {
        action = 'insert';
        payload = Array.isArray(values) ? values : [values];
        return builder;
      },
      upsert(values: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
        action = 'upsert';
        payload = Array.isArray(values) ? values : [values];
        conflictKeys = opts?.onConflict ? opts.onConflict.split(',').map((k) => k.trim()) : ['id'];
        ignoreDuplicates = !!opts?.ignoreDuplicates;
        return builder;
      },
      update(values: Row) {
        action = 'update';
        patch = values;
        return builder;
      },
      delete() {
        action = 'delete';
        return builder;
      },
      eq: (c: string, v: unknown) => filter(condition(c, 'eq', v)),
      neq: (c: string, v: unknown) => filter(condition(c, 'neq', v)),
      gt: (c: string, v: unknown) => filter(condition(c, 'gt', v)),
      gte: (c: string, v: unknown) => filter(condition(c, 'gte', v)),
      lt: (c: string, v: unknown) => filter(condition(c, 'lt', v)),
      lte: (c: string, v: unknown) => filter(condition(c, 'lte', v)),
      is: (c: string, v: unknown) => filter(condition(c, 'is', v)),
      in: (c: string, v: unknown[]) => filter(condition(c, 'in', v)),
      like: (c: string, v: string) => filter(condition(c, 'like', v)),
      ilike: (c: string, v: string) => filter(condition(c, 'ilike', v)),
      contains: (c: string, v: unknown) => filter(condition(c, 'cs', v)),
      containedBy: (c: string, v: unknown) => filter(condition(c, 'cd', v)),
      overlaps: (c: string, v: unknown) => filter(condition(c, 'ov', v)),
      textSearch: () => builder,
      match: (values: Row) => filter((row) => Object.entries(values).every(([c, v]) => same(read(row, c), v))),
      not: (c: string, op: string, v: unknown) => {
        const inner = condition(c, op, typeof v === 'string' && op !== 'in' ? scalar(v) : v);
        return filter((row) => !inner(row));
      },
      filter: (c: string, op: string, v: unknown) => filter(condition(c, op, typeof v === 'string' ? scalar(v) : v)),
      or: (text: string) => filter(parseLogic(text)),
      order(column: string, opts?: { ascending?: boolean; foreignTable?: string; referencedTable?: string }) {
        if (!opts?.foreignTable && !opts?.referencedTable) {
          sorts.push({ column, ascending: opts?.ascending ?? true });
        }
        return builder;
      },
      limit(n: number, opts?: { foreignTable?: string; referencedTable?: string }) {
        if (!opts?.foreignTable && !opts?.referencedTable) {
          limit = n;
        }
        return builder;
      },
      range(from: number, to: number) {
        offset = from;
        limit = to - from + 1;
        return builder;
      },
      single() {
        cardinality = 'single';
        return builder;
      },
      maybeSingle() {
        cardinality = 'maybe';
        return builder;
      },
      returns: () => builder,
      overrideTypes: () => builder,
      abortSignal: () => builder,
      throwOnError: () => builder,
      setHeader: () => builder,
      then<A, B>(resolve: (r: Result) => A, reject?: (e: unknown) => B) {
        try {
          return Promise.resolve(run()).then(resolve, reject);
        } catch (error) {
          return Promise.reject(error).then(resolve, reject);
        }
      }
    };
    return builder;
  }

  async function bytesOf(body: unknown): Promise<Uint8Array> {
    if (body instanceof Uint8Array) {
      return new Uint8Array(body);
    }
    if (body instanceof ArrayBuffer) {
      return new Uint8Array(body);
    }
    if (ArrayBuffer.isView(body)) {
      return new Uint8Array(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength));
    }
    if (body instanceof Blob) {
      return new Uint8Array(await body.arrayBuffer());
    }
    return new TextEncoder().encode(String(body));
  }

  const typeOf = (body: unknown, given?: string) => given ?? (body instanceof Blob && body.type ? body.type : 'application/octet-stream');

  function bucket(name: string) {
    const key = (path: string) => `${name}/${path.replace(/^\/+/, '')}`;
    const signed = (path: string) => options.storageUrl(name, path.replace(/^\/+/, ''));
    const missing = (path: string) => ({ data: null, error: { message: `Object not found: ${path}`, statusCode: '404', name: 'StorageApiError' } });
    const store = async (path: string, body: unknown, opts?: { contentType?: string; upsert?: boolean }) => {
      if (blobs.has(key(path)) && !opts?.upsert) {
        return { data: null, error: { message: 'The resource already exists', statusCode: '409', name: 'StorageApiError' } };
      }
      blobs.set(key(path), { bytes: await bytesOf(body), contentType: typeOf(body, opts?.contentType) });
      options.onChange({ schema: 'public', table: 'storage.objects', eventType: ChangeKind.Insert, new: { bucket: name, path }, old: {}, commit_timestamp: now(), errors: null });
      return { data: { path, id: key(path), fullPath: key(path) }, error: null };
    };
    return {
      upload: store,
      update: (path: string, body: unknown, opts?: { contentType?: string }) => store(path, body, { ...opts, upsert: true }),
      uploadToSignedUrl: (path: string, _token: string, body: unknown, opts?: { contentType?: string; upsert?: boolean }) => store(path, body, opts),
      async download(path: string) {
        const blob = blobs.get(key(path));
        return blob ? { data: new Blob([blob.bytes as BlobPart], { type: blob.contentType }), error: null } : missing(path);
      },
      async exists(path: string) {
        return { data: blobs.has(key(path)), error: null };
      },
      async info(path: string) {
        const blob = blobs.get(key(path));
        return blob ? { data: { size: blob.bytes.byteLength, contentType: blob.contentType, name: path }, error: null } : missing(path);
      },
      async remove(paths: string[]) {
        paths.forEach((p) => blobs.delete(key(p)));
        return { data: paths.map((p) => ({ name: p })), error: null };
      },
      async list(prefix = '') {
        const base = key(prefix).replace(/\/?$/, '/');
        const names = [...blobs.keys()].filter((k) => k.startsWith(base)).map((k) => k.slice(base.length).split('/')[0]);
        return { data: [...new Set(names)].map((n) => ({ name: n, id: n, metadata: {} })), error: null };
      },
      async createSignedUrl(path: string) {
        return { data: { signedUrl: signed(path) }, error: null };
      },
      async createSignedUrls(paths: string[]) {
        return { data: paths.map((p) => ({ path: p, signedUrl: signed(p), error: null })), error: null };
      },
      async createSignedUploadUrl(path: string) {
        return { data: { signedUrl: signed(path), path, token: 'local' }, error: null };
      },
      getPublicUrl(path: string) {
        return { data: { publicUrl: signed(path) } };
      }
    };
  }

  const session = { access_token: 'local', refresh_token: 'local', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 365, token_type: 'bearer', user: options.user };
  const noChannel = {
    on: () => noChannel,
    subscribe: (cb?: (status: string) => void) => {
      cb?.('SUBSCRIBED');
      return noChannel;
    },
    send: async () => 'ok',
    track: async () => 'ok',
    untrack: async () => 'ok',
    unsubscribe: async () => 'ok',
    presenceState: () => ({})
  };

  return {
    from: query,
    schema: () => ({ from: query }),
    rpc: async (name: string) => (name in LOCAL_FUNCTIONS ? { data: LOCAL_FUNCTIONS[name], error: null, count: null, status: HTTP_OK, statusText: 'OK' } : { data: null, error: dbError(FUNCTION_MISSING, `${name} is not available in local mode`), count: null, status: 404, statusText: 'Not Found' }),
    storage: { from: bucket },
    auth: {
      getUser: async () => ({ data: { user: options.user }, error: null }),
      getSession: async () => ({ data: { session }, error: null }),
      refreshSession: async () => ({ data: { session, user: options.user }, error: null }),
      setSession: async () => ({ data: { session, user: options.user }, error: null }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      admin: {
        getUserById: async () => ({ data: { user: options.user }, error: null }),
        listUsers: async () => ({ data: { users: [options.user] }, error: null })
      }
    },
    realtime: { setAuth: async () => {} },
    channel: () => noChannel,
    removeChannel: async () => 'ok',
    removeAllChannels: async () => []
  };
}

export type MemoryDb = ReturnType<typeof createMemoryDb>;
