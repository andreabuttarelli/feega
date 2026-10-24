/**
 * Self-host schema applier. A fresh database gets supabase/baseline (the whole current schema, in
 * file order), then any migration dated after the baseline. The 386 legacy files in
 * supabase/migrations describe the old product and are never applied here; they stay in the repo
 * because migrations are immutable.
 *
 * What ran is recorded in app_schema_migrations; re-running applies only what is new. Each file runs
 * in its own transaction and a failure names the file and line. DATABASE_URL is required and never
 * defaults to a database for you.
 *
 *   npm run db:migrate
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const MIGRATIONS_DIR = join(ROOT, 'supabase/migrations');
export const CANVAS_MIGRATIONS_DIR = join(ROOT, 'supabase/canvas-migrations');
export const BASELINE_DIR = join(ROOT, 'supabase/baseline');
const BASELINE_THROUGH = '20261024090000';
const TIMESTAMP_DIGITS = 14;

function timestampOf(file) {
  const m = file.match(/^(\d+)/);
  return m ? m[1].padEnd(TIMESTAMP_DIGITS, '0') : null;
}

export function selfHostPlan(
  baselineDir = BASELINE_DIR,
  migrationDirs = [MIGRATIONS_DIR, CANVAS_MIGRATIONS_DIR]
) {
  const baseline = readdirSync(baselineDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => ({ file, dir: baselineDir, recordedAs: `baseline/${file}` }));

  const after = migrationDirs
    .flatMap((dir) => (existsSync(dir) ? readdirSync(dir).map((file) => ({ file, dir })) : []))
    .filter(({ file }) => file.endsWith('.sql') && !file.endsWith('.down.sql'))
    .filter(({ file }) => timestampOf(file) > BASELINE_THROUGH)
    .map((entry) => ({ ...entry, recordedAs: entry.file }))
    .sort((a, b) => timestampOf(a.file).localeCompare(timestampOf(b.file)) || a.file.localeCompare(b.file));

  return [...baseline, ...after];
}

/** Every migration file, ordered by its leading number (0007 → 7, 20260702… → 20260702).
 *  Il repo mescola prefissi corti e timestamp: il sort lessicale mette «0089_x» DOPO
 *  «2026…» e rompe l'ordine reale di applicazione — qui si ordina per numero. */
export function listMigrationFiles(dir = MIGRATIONS_DIR) {
  const num = (f) => {
    const m = f.match(/^(\d+)/);
    return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
  };
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => num(a) - num(b) || a.localeCompare(b));
}

/** Files present on disk that are not yet recorded as applied. */
export function pendingMigrations(allFiles, appliedFiles) {
  const applied = new Set(appliedFiles);
  return allFiles.filter((f) => !applied.has(f));
}

/** A pg error's 1-indexed character `position` (offset into the whole query string) → a 1-indexed line number. */
export function lineForPosition(sql, position) {
  const offset = Number(position) - 1;
  if (!Number.isFinite(offset) || offset < 0) return null;
  return sql.slice(0, offset).split('\n').length;
}

/** Statements Postgres refuses inside a transaction block: such a file is applied bare, so a
 *  failure halfway leaves it unrecorded and partially applied — the price of VACUUM. */
const OUTSIDE_TRANSACTION = /^[ \t]*(vacuum|reindex|create\s+index\s+concurrently|drop\s+index\s+concurrently)\b/im;

const DEFERRED_PREREQUISITES = new Map([
  ['0226_realtime_brand_channel_policies.sql', 'realtime.messages']
]);

export function runsInTransaction(sql) {
  return !OUTSIDE_TRANSACTION.test(stripComments(sql));
}

/** Splits a file so every solo-only statement travels alone: several statements in one simple
 *  query are an implicit transaction block, which is exactly what VACUUM refuses. */
export function statementChunks(sql) {
  const chunks = [];
  let current = [];
  let solo = false;

  const flush = () => {
    if (current.join('').trim()) chunks.push(current.join('\n').trim());
    current = [];
  };

  for (const line of sql.split('\n')) {
    if (!solo && OUTSIDE_TRANSACTION.test(line)) {
      flush();
      solo = true;
    }

    current.push(line);

    if (solo && line.trim().endsWith(';')) {
      flush();
      solo = false;
    }
  }
  flush();

  return chunks;
}

function stripComments(sql) {
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function missingPrerequisite(file, error) {
  const prerequisite = DEFERRED_PREREQUISITES.get(file);
  if (!prerequisite || error?.code !== '42P01') return null;
  if (!String(error.message).includes(`"${prerequisite}"`)) return null;
  return prerequisite;
}

export async function applyOne(client, file, dir = MIGRATIONS_DIR, recordedAs = file) {
  const sql = readFileSync(join(dir, file), 'utf8');
  const transactional = runsInTransaction(sql);

  if (transactional) await client.query('begin');
  try {
    // Simple query protocol (no parameters) — runs every ';'-separated statement in the file.
    for (const chunk of transactional ? [sql] : statementChunks(sql)) await client.query(chunk);
    await client.query('insert into app_schema_migrations (filename) values ($1)', [recordedAs]);
    if (transactional) await client.query('commit');
  } catch (err) {
    if (transactional) await client.query('rollback').catch(() => {});

    const prerequisite = missingPrerequisite(file, err);
    if (prerequisite) return { status: 'deferred', prerequisite };

    const line = lineForPosition(sql, err.position);
    throw new Error(`${file}${line ? `:${line}` : ''} — ${err.message}`);
  }

  return { status: 'applied' };
}

async function main() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    console.error(
      'DATABASE_URL is not set. Point it at YOUR Postgres (e.g. from infra/compose) — this script never defaults to a database for you.'
    );
    process.exit(1);
  }

  const { Client } = await import('pg');
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    await client.query(`
      create table if not exists app_schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const { rows } = await client.query('select filename from app_schema_migrations');
    const plan = selfHostPlan();
    const all = plan.map((entry) => entry.recordedAs);
    const pending = pendingMigrations(
      all,
      rows.map((r) => r.filename)
    );

    if (pending.length === 0) {
      console.log(`Up to date — ${all.length} migration(s) already applied.`);
      return;
    }

    console.log(`${pending.length} pending migration(s):`);
    for (const file of pending) console.log(`  ${file}`);

    let applied = 0;
    for (const name of pending) {
      const entry = plan.find((e) => e.recordedAs === name);
      const file = entry.recordedAs;
      const result = await applyOne(client, entry.file, entry.dir, entry.recordedAs);
      if (result.status === 'deferred') {
        console.log(`deferred ${file} — waiting for ${result.prerequisite}`);
        continue;
      }

      console.log(`applied ${file}`);
      applied += 1;
    }

    console.log(`Applied ${applied} migration(s).`);
  } catch (err) {
    console.error(`FAILED: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
