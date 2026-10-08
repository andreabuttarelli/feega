import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const MIGRATION = join(fileURLToPath(new URL('..', import.meta.url)), 'supabase/migrations/20261008120000_gallery_items.sql');

const MINE = '11111111-1111-4111-8111-111111111111';
const THEIRS = '22222222-2222-4222-8222-222222222222';
const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STRANGER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MY_NODE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PUBLISHED = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const REMOVED = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const MY_ITEM = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

const LIVE_SHAPED_STUBS = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  end $$;

  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;

  create table public.orgs (id uuid primary key, name text not null);
  create table public.orgs_members (org_id uuid references public.orgs(id), user_id uuid references auth.users(id));
  create table public.nodes (id uuid primary key, org_id uuid not null references public.orgs(id), type text not null);
  create function public.auth_org_ids() returns setof uuid language sql stable security definer set search_path = '' as $$
    select org_id from public.orgs_members where user_id = auth.uid()
  $$;
  grant usage on schema public to anon, authenticated;
  grant select on public.nodes to authenticated;
  grant execute on function public.auth_org_ids() to anon, authenticated;

  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean not null default false);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text not null, name text not null);
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant execute on function storage.foldername(text) to anon, authenticated;
  grant select, insert, delete on storage.objects to authenticated;
`;

const SEED = `
  insert into auth.users (id) values ('${ME}'), ('${STRANGER}');
  insert into public.orgs (id, name) values ('${MINE}', 'mine'), ('${THEIRS}', 'theirs');
  insert into public.orgs_members (org_id, user_id) values ('${MINE}', '${ME}'), ('${THEIRS}', '${STRANGER}');
  insert into public.nodes (id, org_id, type) values ('${MY_NODE}', '${MINE}', 'motion');
  insert into public.gallery_items (id, org_id, user_id, author_name, title, kind, format, duration_s, doc, status, actor_kind)
    values
      ('${PUBLISHED}', '${THEIRS}', '${STRANGER}', 'Feega', 'Published', 'motion', '16:9', 6, '{}', 'published', 'system'),
      ('${REMOVED}', '${THEIRS}', '${STRANGER}', 'Feega', 'Removed', 'motion', '16:9', 6, '{}', 'removed', 'system'),
      ('${MY_ITEM}', '${MINE}', '${ME}', 'Mine', 'Mine', 'motion', '9:16', 4, '{}', 'unlisted', 'user');
`;

async function as(client, role, userId, sql, params = []) {
  await client.query('savepoint probe');
  try {
    await client.query(`set local role ${role}`);
    await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? '']);
    const result = await client.query(sql, params);
    return { rows: result.rows, rowCount: result.rowCount, error: null };
  } catch (error) {
    return { rows: [], rowCount: 0, error: error.message };
  } finally {
    await client.query('rollback to savepoint probe');
  }
}

const insertItem = (org, user, extra = '') =>
  `insert into public.gallery_items (org_id, user_id, author_name, title, kind, format, duration_s, doc, actor_kind${extra ? ', remix_count' : ''})
   values ('${org}', '${user}', 'x', 'x', 'motion', '16:9', 5, '{}', 'user'${extra ? `, ${extra}` : ''}) returning id`;

const SCENARIOS = [
  {
    name: 'anon reads published and unlisted items, never a removed one',
    run: async (c) => {
      const { rows } = await as(c, 'anon', null, 'select id from public.gallery_items');
      const ids = rows.map((r) => r.id).sort().join(',');
      return ids === [PUBLISHED, MY_ITEM].sort().join(',') ? null : `anon saw ${ids}`;
    }
  },
  {
    name: 'a member sees her own unlisted item, not another org removed one',
    run: async (c) => {
      const { rows } = await as(c, 'authenticated', ME, 'select id from public.gallery_items order by id');
      const ids = rows.map((r) => r.id).sort().join(',');
      return ids === [PUBLISHED, MY_ITEM].sort().join(',') ? null : `member saw ${ids}`;
    }
  },
  {
    name: 'anon cannot publish',
    run: async (c) => ((await as(c, 'anon', null, insertItem(MINE, ME))).error ? null : 'anon inserted')
  },
  {
    name: 'a member publishes in her org as herself',
    run: async (c) => {
      const result = await as(c, 'authenticated', ME, insertItem(MINE, ME));
      return result.rowCount === 1 ? null : `insert refused: ${result.error}`;
    }
  },
  {
    name: 'a member cannot publish in another org',
    run: async (c) => ((await as(c, 'authenticated', ME, insertItem(THEIRS, ME))).error ? null : 'cross-org insert passed')
  },
  {
    name: 'a member cannot publish as somebody else',
    run: async (c) => ((await as(c, 'authenticated', ME, insertItem(MINE, STRANGER))).error ? null : 'impersonated insert passed')
  },
  {
    name: 'a new item cannot start with remixes',
    run: async (c) => ((await as(c, 'authenticated', ME, insertItem(MINE, ME, '99'))).error ? null : 'inflated remix count passed')
  },
  {
    name: 'nobody edits an item of another org',
    run: async (c) => {
      const result = await as(c, 'authenticated', ME, `update public.gallery_items set title = 'hacked' where id = '${PUBLISHED}'`);
      return result.rowCount === 0 ? null : 'cross-org update passed';
    }
  },
  {
    name: 'the owner withdraws her item',
    run: async (c) => {
      const result = await as(c, 'authenticated', ME, `update public.gallery_items set status = 'removed' where id = '${MY_ITEM}'`);
      return result.rowCount === 1 ? null : `withdraw refused: ${result.error}`;
    }
  },
  {
    name: 'the owner cannot inflate her remix count',
    run: async (c) => ((await as(c, 'authenticated', ME, `update public.gallery_items set remix_count = 1000 where id = '${MY_ITEM}'`)).error ? null : 'remix_count update passed')
  },
  {
    name: 'nobody deletes an item: withdrawing keeps the chain',
    run: async (c) => ((await as(c, 'authenticated', ME, `delete from public.gallery_items where id = '${MY_ITEM}'`)).error ? null : 'delete passed')
  },
  {
    name: 'a remix of a published item counts once',
    run: async (c) => {
      await c.query('savepoint count');
      try {
        await c.query('set local role authenticated');
        await c.query(`select set_config('request.jwt.claim.sub', '${ME}', true)`);
        await c.query(`insert into public.gallery_remixes (org_id, item_id, node_id, actor_kind) values ('${MINE}', '${PUBLISHED}', '${MY_NODE}', 'user')`);
        await c.query('reset role');
        const { rows } = await c.query(`select remix_count from public.gallery_items where id = '${PUBLISHED}'`);
        return rows[0].remix_count === 1 ? null : `remix_count is ${rows[0].remix_count}`;
      } catch (error) {
        return `remix refused: ${error.message}`;
      } finally {
        await c.query('rollback to savepoint count');
      }
    }
  },
  {
    name: 'a withdrawn item cannot be remixed',
    run: async (c) =>
      (await as(c, 'authenticated', ME, `insert into public.gallery_remixes (org_id, item_id, node_id, actor_kind) values ('${MINE}', '${REMOVED}', '${MY_NODE}', 'user')`)).error
        ? null
        : 'remix of removed item passed'
  },
  {
    name: 'a remix lands only on a node of the remixer org',
    run: async (c) =>
      (await as(c, 'authenticated', STRANGER, `insert into public.gallery_remixes (org_id, item_id, node_id, actor_kind) values ('${THEIRS}', '${PUBLISHED}', '${MY_NODE}', 'user')`)).error
        ? null
        : 'remix on a foreign node passed'
  },
  {
    name: 'the owner uploads under gallery/<her item>/',
    run: async (c) => {
      const result = await as(c, 'authenticated', ME, `insert into storage.objects (bucket_id, name) values ('media', 'gallery/${MY_ITEM}/poster.jpg')`);
      return result.rowCount === 1 ? null : `upload refused: ${result.error}`;
    }
  },
  {
    name: 'nobody uploads under another org gallery item',
    run: async (c) =>
      (await as(c, 'authenticated', ME, `insert into storage.objects (bucket_id, name) values ('media', 'gallery/${PUBLISHED}/poster.jpg')`)).error ? null : 'foreign gallery upload passed'
  },
  {
    name: 'anon uploads nothing to the gallery',
    run: async (c) => ((await as(c, 'anon', null, `insert into storage.objects (bucket_id, name) values ('media', 'gallery/${MY_ITEM}/x.jpg')`)).error ? null : 'anon upload passed')
  },
  {
    name: 'the gallery count trigger is not callable directly',
    run: async (c) => ((await as(c, 'authenticated', ME, 'select public.gallery_count_remix()')).error ? null : 'trigger function callable')
  }
];

function assertLocal(url) {
  const host = new URL(url).hostname;
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`DATABASE_URL must point at localhost, got ${host}`);
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required');
  }
  assertLocal(url);

  const client = new Client({ connectionString: url });
  await client.connect();
  let failures = 0;
  try {
    await client.query('begin');
    await client.query(LIVE_SHAPED_STUBS);
    await client.query(readFileSync(MIGRATION, 'utf8').replace(/^begin;|commit;\s*$/gm, ''));
    await client.query(SEED);

    for (const scenario of SCENARIOS) {
      const problem = await scenario.run(client);
      failures += problem ? 1 : 0;
      console.log(`${problem ? 'FAIL' : 'ok  '} ${scenario.name}${problem ? `: ${problem}` : ''}`);
    }
  } finally {
    await client.query('rollback').catch(() => {});
    await client.end();
  }

  if (failures) {
    console.error(`${failures} gallery policy scenario(s) failed`);
    process.exit(1);
  }
  console.log(`${SCENARIOS.length} gallery policy scenarios passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
