import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SEED_EMAIL = process.env.SEED_DEMO_EMAIL || 'demo@feega.local';
const SEED_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'feega-demo-2026';
const SEED_ORG_NAME = process.env.SEED_ORG_NAME || 'Demo';
const SEED_ORG_SLUG = 'demo';
const DEMO_PLACE = { project: 'Demo project', slug: 'demo-project', canvas: 'Hello canvas' };
const LOCAL_PLACE = { project: 'Local', slug: 'local', canvas: 'Local' };
const SEED_FRAME_POSITION = { x: 120, y: 80 };
const SEED_FRAME_DATA = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SEED_CREDITS = 1000;
const ACTOR_USER = 'user';
const ROLE_OWNER = 'owner';
const MOTION_DOC_PATH = fileURLToPath(new URL('./seed/demo-motion-doc.json', import.meta.url));

export async function ensurePrivileges(client) {
  const statements = [
    'grant usage on schema public to anon, authenticated, service_role',
    'grant all on all tables in schema public to anon, authenticated, service_role',
    'grant all on all sequences in schema public to anon, authenticated, service_role',
    'grant execute on all functions in schema public to anon, authenticated, service_role'
  ];
  for (const sql of statements) {
    await client.query(sql);
  }
}

export async function ensureDemoUser(gotrueUrl, serviceKey, email, password, fetchImpl = fetch) {
  const headers = {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    'content-type': 'application/json'
  };

  const created = await fetchImpl(`${gotrueUrl}/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password, email_confirm: true })
  });
  if (created.ok) {
    const user = await created.json();
    return { id: user.id, created: true };
  }

  for (let page = 1; page <= 5; page++) {
    const res = await fetchImpl(`${gotrueUrl}/admin/users?page=${page}&per_page=200`, { headers });
    if (!res.ok) {
      break;
    }
    const body = await res.json();
    const users = body.users ?? body;
    if (!Array.isArray(users) || users.length === 0) {
      break;
    }
    const match = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) {
      return { id: match.id, created: false };
    }
  }

  const detail = await created.text().catch(() => created.statusText);
  throw new Error(`could not create or find demo user ${email}: ${created.status} ${detail}`);
}

export async function ensureProfile(client, userId, email) {
  await client.query(
    `insert into profiles (id, email, name, onboarding_seen_at, onboarding_status)
     values ($1, $2, 'Demo', now(), 'dismissed')
     on conflict (id) do update set email = excluded.email`,
    [userId, email]
  );
}

export async function ensureOrg(client, userId, name, slug) {
  const existing = await client.query(
    'select org_id from orgs_members where user_id = $1 and role = $2 limit 1',
    [userId, ROLE_OWNER]
  );
  if (existing.rows[0]) {
    return existing.rows[0].org_id;
  }

  const inserted = await client.query(
    'insert into orgs (name, slug) values ($1, $2) on conflict (slug) do update set name = excluded.name returning id',
    [name, slug]
  );
  const orgId = inserted.rows[0].id;
  await client.query(
    'insert into orgs_members (org_id, user_id, role) values ($1, $2, $3) on conflict do nothing',
    [orgId, userId, ROLE_OWNER]
  );
  return orgId;
}

export async function ensureProject(client, orgId, name, slug) {
  const row = await client.query(
    `insert into projects (org_id, name, slug) values ($1, $2, $3)
     on conflict (org_id, slug) do update set name = excluded.name
     returning id`,
    [orgId, name, slug]
  );
  return row.rows[0].id;
}

export async function ensureCanvas(client, orgId, projectId, name) {
  const existing = await client.query(
    'select id from canvases where project_id = $1 and deleted_at is null order by created_at limit 1',
    [projectId]
  );
  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const inserted = await client.query(
    'insert into canvases (org_id, project_id, name) values ($1, $2, $3) returning id',
    [orgId, projectId, name]
  );
  return inserted.rows[0].id;
}

export async function ensureDemoFrame(client, place, userId, doc) {
  const existing = await client.query(
    "select id from nodes where canvas_id = $1 and type = 'motion' and deleted_at is null limit 1",
    [place.canvasId]
  );
  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const node = await client.query(
    `insert into nodes (org_id, project_id, canvas_id, type, display_name, x, y, data, actor_kind, actor_id)
     values ($1, $2, $3, 'motion', 'Hello frame', $4, $5, $6, $7, $8)
     returning id`,
    [place.orgId, place.projectId, place.canvasId, SEED_FRAME_POSITION.x, SEED_FRAME_POSITION.y, SEED_FRAME_DATA, ACTOR_USER, userId]
  );
  const nodeId = node.rows[0].id;
  await client.query(
    `insert into motion_revisions (org_id, node_id, version, doc, actor_kind, actor_id, summary)
     values ($1, $2, 1, $3, $4, $5, 'Demo frame')`,
    [place.orgId, nodeId, doc, ACTOR_USER, userId]
  );
  return nodeId;
}

export async function ensureCredits(client, orgId) {
  const existing = await client.query('select 1 from credit_ledger where org_id = $1 limit 1', [orgId]);
  if (existing.rows[0]) {
    return;
  }

  await client.query(
    "insert into credit_ledger (org_id, kind, source, amount, note) values ($1, 'grant', 'manual', $2, 'self-host demo credits')",
    [orgId, SEED_CREDITS]
  );
}

export function seedPlace(env) {
  return env.FEEGA_LOCAL_MODE === '1' ? LOCAL_PLACE : DEMO_PLACE;
}

export async function seed(client, userId, email) {
  const place = seedPlace(process.env);
  await ensureProfile(client, userId, email);
  const orgId = await ensureOrg(client, userId, SEED_ORG_NAME, SEED_ORG_SLUG);
  const projectId = await ensureProject(client, orgId, place.project, place.slug);
  const canvasId = await ensureCanvas(client, orgId, projectId, place.canvas);
  const doc = JSON.parse(readFileSync(MOTION_DOC_PATH, 'utf8'));
  await ensureDemoFrame(client, { orgId, projectId, canvasId }, userId, doc);
  await ensureCredits(client, orgId);
  return { orgId, projectId, canvasId };
}

async function main() {
  const missing = ['DATABASE_URL', 'PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter(
    (k) => !process.env[k]
  );
  if (missing.length) {
    console.error(`Missing required env: ${missing.join(', ')}`);
    process.exit(1);
  }

  const gotrueUrl = `${process.env.PUBLIC_SUPABASE_URL.replace(/\/$/, '')}/auth/v1`;
  const user = await ensureDemoUser(gotrueUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, SEED_EMAIL, SEED_PASSWORD);

  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await ensurePrivileges(client);
    const place = await seed(client, user.id, SEED_EMAIL);
    const appUrl = (process.env.PUBLIC_APP_URL || 'http://localhost:5173').replace(/\/$/, '');
    console.log(`\nDemo canvas: ${appUrl}/p/${place.projectId}/c/${place.canvasId}`);
    if (seedPlace(process.env) === LOCAL_PLACE) {
      console.log(`Local mode: open ${appUrl}/ — no login.\n`);
      return;
    }
    console.log(`Log in at ${appUrl}/login\n  email:    ${SEED_EMAIL}\n  password: ${SEED_PASSWORD}\n`);
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`FAILED: ${err.message}`);
    process.exit(1);
  });
}
