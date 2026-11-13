import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const MIGRATIONS = ['20261113_agent_edit_counts.sql', '20261114_history_append_only.sql'].map((file) =>
  readFileSync(join(fileURLToPath(new URL('..', import.meta.url)), 'supabase/canvas-migrations', file), 'utf8')
);

const STUBS = `
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create function auth.role() returns text language sql as $$ select 'service_role' $$;
  create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
  create function public.auth_org_ids() returns setof uuid language sql as $$ select null::uuid where false $$;
  create function public.auth_editor_org_ids() returns setof uuid language sql as $$ select null::uuid where false $$;
  create table public.nodes (id uuid primary key, org_id uuid not null, type text not null);
  create table public.canvas_events (id bigserial primary key, org_id uuid, actor_kind text, actor_id uuid, created_at timestamptz default now());
  insert into public.nodes values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'motion');
  create table public.motion_revisions (
    id uuid primary key default gen_random_uuid(), org_id uuid not null, node_id uuid not null, version integer not null,
    doc jsonb not null, summary text, actor_kind text not null, actor_id uuid, agent_key text, session_id uuid,
    sealed boolean not null default false, created_at timestamptz not null default now()
  );
`;

const ORG = '11111111-1111-4111-8111-111111111111';
const NODE = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';

let failures = 0;
const report = (ok, line) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${line}`);
  failures += ok ? 0 : 1;
};

const db = new PGlite();
await db.exec(STUBS);
for (const migration of MIGRATIONS) {
  await db.exec(migration);
}

const commit = (expected, layers) =>
  db.query(`select public.commit_motion_revision($1, $2, $3, '{}'::jsonb, null, 'agent', $4, 'mcp', 3000, null, $5) as v`, [ORG, NODE, expected, USER, layers]);

await commit(0, 4);
await commit(1, 3);
await commit(2, 5);
const rows = (await db.query('select version, layers_touched from public.motion_revisions')).rows;
report(rows.length === 1 && rows[0].layers_touched === 12 && rows[0].version === 3, `a burst folded into one checkpoint adds every layer it changed: got ${JSON.stringify(rows)}`);

process.exit(failures ? 1 : 0);
