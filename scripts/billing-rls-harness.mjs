import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { selfHostPlan } from './db-migrate.mjs';

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
const PROJECT = '33333333-3333-4333-8333-333333333333';
const CANVAS = '44444444-4444-4444-8444-444444444444';
const NODE = '55555555-5555-4555-8555-555555555555';
const INVITE = '66666666-6666-4666-8666-666666666666';
const MEMBER_KEY = '77777777-7777-4777-8777-777777777777';
const OWNER_KEY = '88888888-8888-4888-8888-888888888888';
const RUN = '99999999-9999-4999-8999-999999999999';
const SERVER_VALUE = '{"quotedUsd": 2}';

const User = {
  Owner: 'a0000000-0000-4000-8000-000000000001',
  Admin: 'a0000000-0000-4000-8000-000000000002',
  Member: 'a0000000-0000-4000-8000-000000000003',
  Viewer: 'a0000000-0000-4000-8000-000000000004',
  Stranger: 'a0000000-0000-4000-8000-000000000005',
  Service: 'service',
  Anon: null
};

const ROLE_OF = (user) => (user === User.Service ? 'service_role' : user ? 'authenticated' : 'anon');

const Want = { Lands: 'lands', Refused: 'refused' };

const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create function auth.role() returns text language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
  $$;
  grant usage on schema auth to anon, authenticated, service_role;

  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  alter table storage.objects enable row level security;

  create schema realtime;
  create table realtime.messages (id bigserial primary key, topic text);
  create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$;
  alter table realtime.messages enable row level security;
  create publication supabase_realtime;

  create schema extensions;
  create function extensions.jsonb_matches_schema(schema json, instance jsonb) returns boolean language sql immutable as $$ select true $$;

  create schema stripe;
  create table stripe.prices (_raw_data jsonb, id text generated always as (_raw_data->>'id') stored primary key);
  create table stripe.subscriptions (_raw_data jsonb, id text generated always as (_raw_data->>'id') stored primary key);
  create table stripe.invoices (_raw_data jsonb, id text generated always as (_raw_data->>'id') stored primary key);
  create table stripe.checkout_sessions (_raw_data jsonb, id text generated always as (_raw_data->>'id') stored primary key);
`;

const PGLITE_HAS_NO_PGVECTOR = [
  [/create extension if not exists vector with schema extensions;/g, ''],
  [/\bvector\(1536\)/g, 'text']
];

const SEED = `
  insert into auth.users (id) values ${Object.values(User).filter((u) => u && u !== User.Service).map((id) => `('${id}')`).join(', ')};
  insert into public.profiles (id, email) select id, id || '@feega.test' from auth.users;
  insert into public.orgs (id, name, slug) values ('${ORG}', 'Acme', 'acme'), ('${OTHER_ORG}', 'Other', 'other');
  insert into public.orgs_members (org_id, user_id, role) values
    ('${ORG}', '${User.Owner}', 'owner'), ('${ORG}', '${User.Admin}', 'admin'),
    ('${ORG}', '${User.Member}', 'member'), ('${ORG}', '${User.Viewer}', 'viewer'),
    ('${OTHER_ORG}', '${User.Stranger}', 'owner');
  insert into public.orgs_invites (id, org_id, email, role, token, expires_at) values ('${INVITE}', '${ORG}', 'new@acme.test', 'viewer', 'hash', now() + interval '7 days');
  insert into public.projects (id, org_id, name, slug) values ('${PROJECT}', '${ORG}', 'P', 'p');
  insert into public.canvases (id, org_id, project_id, name) values ('${CANVAS}', '${ORG}', '${PROJECT}', 'C');
  insert into public.nodes (id, org_id, project_id, canvas_id, type, x, y) values ('${NODE}', '${ORG}', '${PROJECT}', '${CANVAS}', 'motion', 0, 0);
  insert into public.credit_ledger (org_id, kind, source, amount) values ('${ORG}', 'grant', 'promo', 100), ('${ORG}', 'debit', 'ai_usage', 40);
  insert into public.ai_calls (org_id, provider, operation, status, cost_usd) values ('${ORG}', 'openai', 'chat', 'ok', 1.5);
  insert into public.api_keys (id, org_id, user_id, name, key_hash, key_prefix) values ('${MEMBER_KEY}', '${ORG}', '${User.Member}', 'mine', 'h1', 'feega_m');
  insert into public.api_keys (id, org_id, user_id, name, key_hash, key_prefix) values ('${OWNER_KEY}', '${ORG}', '${User.Owner}', 'owner', 'h0', 'feega_o');
  insert into public.node_runs (id, org_id, node_id, params) values ('${RUN}', '${ORG}', '${NODE}', '${SERVER_VALUE}');
  insert into public.canvas_events (org_id, canvas_id, kind, actor_kind, agent_key) values ('${ORG}', '${CANVAS}', 'node.create', 'agent', 'mcp');
  insert into public.motion_revisions (org_id, node_id, version, doc, actor_kind, actor_id) values ('${ORG}', '${NODE}', 1, '{}', 'agent', '${User.Member}');
`;

const commit = (expected, actorId = User.Member) =>
  `select public.commit_motion_revision('${ORG}', '${NODE}', ${expected}, '{"v":${expected + 1}}'::jsonb, 's', 'user', '${actorId}', null, 60000, null) as version`;

const PROBES_BY_TABLE = [
  ...[User.Owner, User.Admin, User.Member, User.Viewer].map((user) => ({
    name: `orgs: ${roleName(user)} cannot link a subscription`,
    user,
    sql: `update public.orgs set stripe_subscription_id = 'sub_forged' where id = '${ORG}'`,
    want: Want.Refused
  })),
  { name: 'orgs: the owner cannot set the Stripe customer', user: User.Owner, sql: `update public.orgs set stripe_customer_id = 'cus_x' where id = '${ORG}'`, want: Want.Refused },
  { name: 'orgs: the owner cannot grant a store plan', user: User.Owner, sql: `update public.orgs set store_plan_product = 'feega_monthly_9', store_plan_expires_at = now() + interval '1 year' where id = '${ORG}'`, want: Want.Refused },
  { name: 'orgs: a session cannot create a paid org', user: User.Owner, sql: `insert into public.orgs (name, slug, stripe_subscription_id) values ('x', 'x', 'sub_x')`, want: Want.Refused },
  { name: 'orgs: the owner cannot delete the org', user: User.Owner, sql: `delete from public.orgs where id = '${ORG}'`, want: Want.Refused },
  { name: 'orgs: anon cannot write an org', user: User.Anon, sql: `update public.orgs set stripe_subscription_id = 'sub_x'`, want: Want.Refused },
  {
    name: 'orgs: a billing column added later is closed by default',
    user: User.Owner,
    setup: 'alter table public.orgs add column if not exists seats_paid integer',
    sql: `update public.orgs set seats_paid = 99 where id = '${ORG}'`,
    want: Want.Refused
  },
  { name: 'orgs: a viewer reads her org', user: User.Viewer, sql: `select id from public.orgs where id = '${ORG}'`, want: Want.Lands },
  { name: 'orgs: another org cannot read it', user: User.Stranger, sql: `select id from public.orgs where id = '${ORG}'`, want: Want.Refused },

  { name: 'orgs_members: an admin cannot promote a viewer directly', user: User.Admin, sql: `update public.orgs_members set role = 'member' where user_id = '${User.Viewer}'`, want: Want.Refused },
  { name: 'orgs_members: the owner cannot change a role directly', user: User.Owner, sql: `update public.orgs_members set role = 'admin' where user_id = '${User.Member}'`, want: Want.Refused },
  { name: 'orgs_members: a member cannot add someone', user: User.Member, sql: `insert into public.orgs_members (org_id, user_id, role) values ('${ORG}', '${User.Stranger}', 'admin')`, want: Want.Refused },
  { name: 'orgs_members: an outsider cannot join', user: User.Stranger, sql: `insert into public.orgs_members (org_id, user_id, role) values ('${ORG}', '${User.Stranger}', 'owner')`, want: Want.Refused },
  { name: 'orgs_members: an admin still removes a member', user: User.Admin, sql: `delete from public.orgs_members where user_id = '${User.Viewer}' and org_id = '${ORG}'`, want: Want.Lands },
  { name: 'orgs_members: a member still leaves', user: User.Member, sql: `delete from public.orgs_members where user_id = '${User.Member}' and org_id = '${ORG}'`, want: Want.Lands },
  { name: 'orgs_members: the owner row cannot be removed', user: User.Admin, sql: `delete from public.orgs_members where user_id = '${User.Owner}'`, want: Want.Refused },
  { name: 'orgs_members: a viewer reads the team', user: User.Viewer, sql: `select user_id from public.orgs_members where org_id = '${ORG}'`, want: Want.Lands },
  { name: 'orgs_members: an admin cannot take ownership', user: User.Admin, sql: `select public.transfer_org_ownership('${ORG}', '${User.Admin}')`, want: Want.Refused },

  { name: 'orgs_invites: an admin cannot invite an editor directly', user: User.Admin, sql: `insert into public.orgs_invites (org_id, email, role, token, expires_at) values ('${ORG}', 'x@y.z', 'member', 't', now() + interval '1 day')`, want: Want.Refused },
  { name: 'orgs_invites: an admin cannot raise a pending invite', user: User.Admin, sql: `update public.orgs_invites set role = 'admin' where id = '${INVITE}'`, want: Want.Refused },
  { name: 'orgs_invites: an admin still lists invites', user: User.Admin, sql: `select id from public.orgs_invites where org_id = '${ORG}'`, want: Want.Lands },
  { name: 'orgs_invites: an admin still revokes an invite', user: User.Admin, sql: `delete from public.orgs_invites where id = '${INVITE}'`, want: Want.Lands },

  ...[User.Owner, User.Admin, User.Member].map((user) => ({
    name: `credit_ledger: ${roleName(user)} cannot grant credits`,
    user,
    sql: `insert into public.credit_ledger (org_id, kind, source, amount) values ('${ORG}', 'grant', 'promo', 1000000)`,
    want: Want.Refused
  })),
  { name: 'credit_ledger: a member cannot inflate a grant', user: User.Member, sql: `update public.credit_ledger set amount = 1000000 where org_id = '${ORG}'`, want: Want.Refused },
  { name: 'credit_ledger: a member cannot erase a debit', user: User.Member, sql: `delete from public.credit_ledger where kind = 'debit'`, want: Want.Refused },
  { name: 'credit_ledger: a viewer reads her org ledger', user: User.Viewer, sql: `select id from public.credit_ledger where org_id = '${ORG}'`, want: Want.Lands },
  { name: 'credit_ledger: another org reads nothing', user: User.Stranger, sql: `select id from public.credit_ledger where org_id = '${ORG}'`, want: Want.Refused },
  { name: 'credit_ledger: a member reads the balance', user: User.Member, sql: `select 1 where public.org_credit_balance('${ORG}') = 60`, want: Want.Lands },
  { name: 'credit_ledger: another org reads no balance', user: User.Stranger, sql: `select 1 where public.org_credit_balance('${ORG}') <> 0`, want: Want.Refused },

  { name: 'ai_calls: a member cannot erase usage', user: User.Member, sql: `delete from public.ai_calls where org_id = '${ORG}'`, want: Want.Refused },
  { name: 'ai_calls: a member cannot rewrite a cost', user: User.Member, sql: `update public.ai_calls set cost_usd = 0 where org_id = '${ORG}'`, want: Want.Refused },
  { name: 'ai_calls: a member cannot log a call', user: User.Member, sql: `insert into public.ai_calls (org_id, provider, operation, status) values ('${ORG}', 'x', 'chat', 'ok')`, want: Want.Refused },
  { name: 'ai_calls: a viewer reads usage', user: User.Viewer, sql: `select id from public.ai_calls where org_id = '${ORG}'`, want: Want.Lands },

  { name: "api_keys: a member cannot mint a key in the owner's name", user: User.Member, sql: `insert into public.api_keys (org_id, user_id, name, key_hash, key_prefix) values ('${ORG}', '${User.Owner}', 'x', 'h2', 'feega_x')`, want: Want.Refused },
  { name: 'api_keys: a member cannot hand her key to the owner', user: User.Member, sql: `update public.api_keys set user_id = '${User.Owner}' where id = '${MEMBER_KEY}'`, want: Want.Refused },
  { name: 'api_keys: a member still creates her own key', user: User.Member, sql: `insert into public.api_keys (org_id, user_id, name, key_hash, key_prefix) values ('${ORG}', '${User.Member}', 'x', 'h3', 'feega_y')`, want: Want.Lands },
  { name: 'api_keys: a member still deletes her own key', user: User.Member, sql: `delete from public.api_keys where id = '${MEMBER_KEY}'`, want: Want.Lands },
  { name: "api_keys: a member cannot delete someone else's key", user: User.Member, sql: `delete from public.api_keys where id = '${OWNER_KEY}'`, want: Want.Refused },
  { name: "api_keys: an admin still revokes a member's key", user: User.Admin, sql: `delete from public.api_keys where id = '${MEMBER_KEY}'`, want: Want.Lands },
  { name: 'api_keys: a viewer cannot create a key', user: User.Viewer, sql: `insert into public.api_keys (org_id, user_id, name, key_hash, key_prefix) values ('${ORG}', '${User.Viewer}', 'x', 'h4', 'feega_z')`, want: Want.Refused },

  { name: 'canvas_events: a member cannot erase agent history', user: User.Member, sql: `delete from public.canvas_events where actor_kind = 'agent'`, want: Want.Refused },
  { name: 'canvas_events: a member cannot relabel an agent event', user: User.Member, sql: `update public.canvas_events set actor_kind = 'user' where actor_kind = 'agent'`, want: Want.Refused },
  { name: 'canvas_events: an editor still records an event', user: User.Member, sql: `insert into public.canvas_events (org_id, canvas_id, kind, actor_kind, actor_id) values ('${ORG}', '${CANVAS}', 'node.update', 'user', '${User.Member}')`, want: Want.Lands },
  { name: 'canvas_events: a viewer cannot record an event', user: User.Viewer, sql: `insert into public.canvas_events (org_id, canvas_id, kind, actor_kind) values ('${ORG}', '${CANVAS}', 'node.update', 'user')`, want: Want.Refused },
  { name: 'canvas_events: a viewer reads history', user: User.Viewer, sql: `select id from public.canvas_events where org_id = '${ORG}'`, want: Want.Lands },

  { name: 'motion_revisions: a member cannot delete a revision', user: User.Member, sql: `delete from public.motion_revisions where org_id = '${ORG}'`, want: Want.Refused },
  { name: 'motion_revisions: a member cannot relabel an agent revision', user: User.Member, sql: `update public.motion_revisions set actor_kind = 'user' where actor_kind = 'agent'`, want: Want.Refused },
  { name: 'motion_revisions: a member cannot backdate a revision', user: User.Member, sql: `update public.motion_revisions set created_at = now() - interval '30 days'`, want: Want.Refused },
  { name: 'motion_revisions: a member still seals a revision', user: User.Member, sql: `update public.motion_revisions set sealed = true where org_id = '${ORG}' and version = 1`, want: Want.Lands },
  { name: 'motion_revisions: an editor still appends a revision', user: User.Member, sql: `insert into public.motion_revisions (org_id, node_id, version, doc, actor_kind, actor_id) values ('${ORG}', '${NODE}', 2, '{}', 'user', '${User.Member}')`, want: Want.Lands },
  { name: 'motion_revisions: an editor still commits a new version', user: User.Member, sql: `select 1 from (${commit(1)}) c where c.version = 2`, want: Want.Lands },
  {
    name: 'motion_revisions: an editor still folds an edit into her own head',
    user: User.Member,
    setup: `insert into public.motion_revisions (org_id, node_id, version, doc, actor_kind, actor_id) values ('${ORG}', '${NODE}', 2, '{}', 'user', '${User.Member}')`,
    sql: `select 1 from (${commit(2)}) c where c.version = 3 and (select count(*) from public.motion_revisions where org_id = '${ORG}') = 2`,
    want: Want.Lands
  },
  {
    name: 'motion_revisions: an editor still folds an edit that counts its layers',
    user: User.Member,
    setup: `insert into public.motion_revisions (org_id, node_id, version, doc, actor_kind, actor_id) values ('${ORG}', '${NODE}', 2, '{}', 'user', '${User.Member}')`,
    sql: [
      `select public.commit_motion_revision('${ORG}', '${NODE}', 2, '{}'::jsonb, 's', 'user', '${User.Member}', null, 60000, null, 3)`,
      `select 1 from public.motion_revisions where org_id = '${ORG}' and version = 3 and layers_touched = 3 and (select count(*) from public.motion_revisions where org_id = '${ORG}') = 2`
    ],
    want: Want.Lands
  },
  { name: 'motion_revisions: a member cannot rewrite a layer count', user: User.Member, sql: `update public.motion_revisions set layers_touched = 0`, want: Want.Refused },
  { name: 'motion_revisions: a viewer cannot commit with a layer count', user: User.Viewer, sql: `select public.commit_motion_revision('${ORG}', '${NODE}', 1, '{}'::jsonb, 's', 'user', '${User.Viewer}', null, 60000, null, 3)`, want: Want.Refused },
  { name: 'motion_revisions: every commit_motion_revision overload checks its caller', user: User.Service, sql: `select 1 where not exists (select 1 from pg_proc where proname = 'commit_motion_revision' and not prosecdef) and (select count(*) from pg_proc where proname = 'commit_motion_revision') = 2`, want: Want.Lands },
  { name: 'motion_revisions: a viewer cannot commit', user: User.Viewer, sql: `select 1 from (${commit(1, User.Viewer)}) c where c.version = 2`, want: Want.Refused },
  { name: 'motion_revisions: another org cannot commit', user: User.Stranger, sql: `select 1 from (${commit(1, User.Stranger)}) c where c.version = 2`, want: Want.Refused }
];

const HARDENING = [
  '20261114_orgs_read_only.sql',
  '20261114_team_writes_server_only.sql',
  '20261114_money_rows_read_only.sql',
  '20261114_api_keys_own_user.sql',
  '20261114_history_append_only.sql',
  '20261114_runs_server_written.sql'
];

const UNAPPLIED_SIBLINGS = ['20261112_credits_never_expire.sql', '20261113_editor_seats.sql', '20261113_agent_edit_counts.sql'];

const DEFINERS_A_SESSION_CALLS = {
  'auth_admin_org_ids()': 'reads only the caller rows',
  'auth_editor_org_ids()': 'reads only the caller rows',
  'auth_org_ids()': 'reads only the caller rows',
  'auth_project_ids()': 'reads only the caller rows',
  'billing_grants_ready()': 'reads trigger names, no tenant data',
  'commit_motion_revision(uuid,uuid,integer,jsonb,text,text,uuid,text,integer,uuid)': 'motion_revision_writer refuses a non-editor',
  'commit_motion_revision(uuid,uuid,integer,jsonb,text,text,uuid,text,integer,uuid,integer)': 'motion_revision_writer refuses a non-editor',
  'org_credit_balance(uuid)': 'sums only an org in auth_org_ids()',
  'project_has_shares(uuid)': 'a boolean for any project id: an oracle, no write',
  'project_has_uncensored_outputs(uuid)': 'a boolean for any project id: an oracle, no write',
  'project_is_uncensored(uuid)': 'a boolean for any project id: an oracle, no write',
  'uncensored_switch_refusal(uuid,uuid)': 'a refusal code for any org id: an oracle, no write',
  'voice_owned_elsewhere(text,uuid)': 'a boolean for any voice id: an oracle, no write'
};

const RUN_VALUE_PROBES = [
  { name: 'node_runs: a session cannot create a run', user: User.Member, sql: `insert into public.node_runs (org_id, node_id, params) values ('${ORG}', '${NODE}', '{}') returning id`, want: Want.Refused },
  { name: 'node_runs: a session cannot change what a run was quoted', user: User.Member, sql: `update public.node_runs set params = params || '{"quotedUsd": 0.0001}' where id = '${RUN}'`, want: Want.Refused },
  { name: 'node_runs: a session cannot change what a run cost', user: User.Member, sql: `update public.node_runs set cost_usd = 0 where id = '${RUN}'`, want: Want.Refused },
  { name: 'node_runs: a session cannot repoint a run at another job', user: User.Member, sql: `update public.node_runs set external_job_id = 'kie:another' where id = '${RUN}'`, want: Want.Refused },
  { name: 'node_runs: a session cannot change a run status', user: User.Member, sql: `update public.node_runs set status = 'failed' where id = '${RUN}'`, want: Want.Refused },
  { name: 'node_runs: a session cannot delete a run', user: User.Member, sql: `delete from public.node_runs where id = '${RUN}'`, want: Want.Refused },
  { name: 'node_runs: a viewer still reads runs', user: User.Viewer, sql: `select id from public.node_runs where org_id = '${ORG}'`, want: Want.Lands },
  { name: 'node_runs: the server still writes a run', user: User.Service, sql: `update public.node_runs set params = params || '{"quotedUsd": 3}', cost_usd = 1 where id = '${RUN}'`, want: Want.Lands },
  { name: 'node_runs: run params are always an object', user: User.Service, sql: `update public.node_runs set params = '[1, 2]' where id = '${RUN}'`, want: Want.Refused }
];

const TEAM_FUNCTION_PROBES = [
  { name: 'orgs_members: a session cannot move ownership around the server', user: User.Owner, sql: `select public.transfer_org_ownership('${ORG}', '${User.Viewer}')`, want: Want.Refused },
  { name: 'orgs_members: a session cannot hand the org over directly', user: User.Owner, sql: `select public.hand_over_org('${ORG}', '${User.Owner}', '${User.Viewer}', 'viewer')`, want: Want.Refused },
  {
    name: 'orgs_members: the server hands the org over in one step',
    user: User.Service,
    sql: [
      `select public.hand_over_org('${ORG}', '${User.Owner}', '${User.Viewer}', 'viewer')`,
      `select 1 where (select role from public.orgs_members where user_id = '${User.Viewer}') = 'owner' and (select role from public.orgs_members where user_id = '${User.Owner}') = 'viewer'`
    ],
    want: Want.Lands
  },
  { name: 'orgs_members: a hand-over never makes two owners', user: User.Service, sql: `select public.hand_over_org('${ORG}', '${User.Owner}', '${User.Viewer}', 'owner')`, want: Want.Refused }
];

const ATTRIBUTION_PROBES = [
  { name: 'motion_revisions: a session cannot credit a revision to a teammate', user: User.Member, sql: `select public.commit_motion_revision('${ORG}', '${NODE}', 1, '{}'::jsonb, 's', 'user', '${User.Owner}', null, 0, null)`, want: Want.Refused },
  { name: 'motion_revisions: a session cannot credit a counted revision to a teammate', user: User.Member, sql: `select public.commit_motion_revision('${ORG}', '${NODE}', 1, '{}'::jsonb, 's', 'agent', '${User.Owner}', 'mcp', 0, null, 3)`, want: Want.Refused },
  { name: 'motion_revisions: an agent acting for the caller is still the caller', user: User.Member, sql: `select 1 from (select public.commit_motion_revision('${ORG}', '${NODE}', 1, '{}'::jsonb, 's', 'agent', '${User.Member}', 'mcp', 0, null, 3) as v) c where c.v = 2`, want: Want.Lands },
  { name: 'motion_revisions: the server still writes for whoever acted', user: User.Service, sql: `select 1 from (select public.commit_motion_revision('${ORG}', '${NODE}', 1, '{}'::jsonb, 's', 'agent', '${User.Owner}', 'mcp', 0, null, 3) as v) c where c.v = 2`, want: Want.Lands }
];

const PROBES = [...PROBES_BY_TABLE, ...RUN_VALUE_PROBES, ...TEAM_FUNCTION_PROBES, ...ATTRIBUTION_PROBES];

const REALTIME_TABLES = ['canvases', 'node_runs', 'nodes', 'nodes_connections'];

function roleName(user) {
  return Object.entries(User).find(([, id]) => id === user)[0].toLowerCase();
}

async function load(db) {
  await db.exec(SUPABASE_STUBS);
  for (const { file, dir, recordedAs } of selfHostPlan()) {
    const sql = PGLITE_HAS_NO_PGVECTOR.reduce((s, [from, to]) => s.replace(from, to), readFileSync(join(dir, file), 'utf8'));
    try {
      await db.exec(sql);
    } catch (e) {
      throw new Error(`${recordedAs}: ${e.message}`);
    }
  }
  await db.exec(SEED);
}

async function probe(db, { user, setup, sql }) {
  await db.exec('begin');
  try {
    if (setup) {
      await db.exec(setup);
    }
    await db.exec(`set local role ${ROLE_OF(user)}`);
    await db.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)`, [user === User.Service ? '' : (user ?? ''), ROLE_OF(user)]);
    const steps = [sql].flat();
    for (const step of steps.slice(0, -1)) {
      await db.query(step);
    }
    const result = await db.query(steps.at(-1));
    const touched = result.affectedRows || result.rows.length;
    return { outcome: touched ? Want.Lands : Want.Refused, detail: `${touched} row(s)` };
  } catch (e) {
    return { outcome: Want.Refused, detail: e.message };
  } finally {
    await db.exec('rollback');
  }
}

async function reapplies(db) {
  const plan = selfHostPlan();
  for (const file of HARDENING) {
    const entry = plan.find((e) => e.file === file);
    if (!entry) {
      return `${file} is not in the self-host plan`;
    }
    try {
      await db.exec(readFileSync(join(entry.dir, file), 'utf8'));
    } catch (e) {
      return `${file} does not re-apply: ${e.message}`;
    }
  }
  return null;
}

async function unreviewedDefiners(db) {
  const { rows } = await db.query(
    `select p.oid::regprocedure::text as fn
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
       and has_function_privilege('authenticated', p.oid, 'execute')`
  );
  const unknown = rows.map((r) => r.fn).filter((fn) => !(fn in DEFINERS_A_SESSION_CALLS));
  return unknown.length ? `not reviewed: ${unknown.join(', ')}` : null;
}

async function applyLate(db) {
  const plan = selfHostPlan();
  for (const file of UNAPPLIED_SIBLINGS) {
    const entry = plan.find((e) => e.file === file);
    if (!entry) {
      return `${file} is not in the self-host plan`;
    }
    try {
      await db.exec(readFileSync(join(entry.dir, file), 'utf8'));
    } catch (e) {
      return `${file}: ${e.message}`;
    }
  }
  return null;
}

async function realtimeIntact(db) {
  const { rows } = await db.query(
    `select c.relname, c.relreplident = 'f' as full, exists (select 1 from pg_publication_tables p where p.pubname = 'supabase_realtime' and p.tablename = c.relname) as published
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = any($1)`,
    [REALTIME_TABLES]
  );
  const broken = rows.filter((r) => !r.full || !r.published).map((r) => r.relname);
  return broken.length || rows.length !== REALTIME_TABLES.length ? `realtime broken on ${broken.join(', ') || 'missing tables'}` : null;
}

const db = await PGlite.create({ extensions: { pgcrypto, uuid_ossp } });
await load(db);

let failures = 0;
async function runProbes(order) {
  let failed = 0;
  for (const p of PROBES) {
    const { outcome, detail } = await probe(db, p);
    const ok = outcome === p.want;
    failed += ok ? 0 : 1;
    console.log(`${ok ? 'ok  ' : 'FAIL'} [${order}] ${p.name}${ok ? '' : ` — want ${p.want}, got ${outcome} (${detail})`}`);
  }
  return failed;
}

failures += await runProbes('in date order');

const unreviewed = await unreviewedDefiners(db);
failures += unreviewed ? 1 : 0;
console.log(`${unreviewed ? 'FAIL' : 'ok  '} every SECURITY DEFINER a session can call checks the caller${unreviewed ? ` — ${unreviewed}` : ''}`);

const again = await reapplies(db);
failures += again ? 1 : 0;
console.log(`${again ? 'FAIL' : 'ok  '} the hardening migrations re-apply cleanly${again ? ` — ${again}` : ''}`);

const late = await applyLate(db);
failures += late ? 1 : 0;
console.log(`${late ? 'FAIL' : 'ok  '} the unapplied sibling migrations re-apply after the hardening${late ? ` — ${late}` : ''}`);
failures += await runProbes('siblings applied after the hardening');

const realtime = await realtimeIntact(db);
failures += realtime ? 1 : 0;
console.log(`${realtime ? 'FAIL' : 'ok  '} realtime: ${REALTIME_TABLES.join(', ')} stay published with replica identity full${realtime ? ` — ${realtime}` : ''}`);

console.log(`\n${2 * PROBES.length + 4 - failures}/${2 * PROBES.length + 4} passed`);
process.exit(failures ? 1 : 0);
