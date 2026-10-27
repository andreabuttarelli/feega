import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const SOURCE_PROJECT = 'ec948b64-7dd0-48b6-ad52-51eb232cc821';
const SOURCE_CANVAS = '0aef6d1a-b9e4-462f-8bb6-a43d1209edc1';
const TEST_EMAIL = 'test@dazero.co';
const COPY_NAME = 'PERF heavy canvas copy';
const BUCKET = 'canvas-assets';
const BATCH = 100;
const OUT = new URL('./fixture.json', import.meta.url);

const url = process.env.PUBLIC_SUPABASE_URL;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const reader = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, options);
const writer = createClient(url, process.env.PUBLIC_SUPABASE_ANON_KEY, options);

async function ok(result) {
  const { data, error } = await result;
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

async function chunked(table, rows) {
  for (let i = 0; i < rows.length; i += BATCH) {
    await ok(writer.from(table).insert(rows.slice(i, i + BATCH)));
  }
}

async function removePrevious(orgId) {
  const old = await ok(writer.from('projects').select('id').eq('org_id', orgId).eq('name', COPY_NAME));
  for (const { id } of old) {
    const assets = await ok(writer.from('assets').select('url').eq('project_id', id));
    const paths = assets.map((a) => a.url).filter((u) => u && !/^https?:/.test(u));
    if (paths.length) {
      await writer.storage.from(BUCKET).remove(paths);
    }
    for (const table of ['nodes', 'assets', 'canvases']) {
      await ok(writer.from(table).delete().eq('project_id', id));
    }
    await ok(writer.from('projects').delete().eq('id', id));
  }
}

const signed = await writer.auth.signInWithPassword({ email: TEST_EMAIL, password: process.env.E2E_TEST_PASSWORD });
if (signed.error || signed.data.user.email !== TEST_EMAIL) {
  throw new Error('sign-in as the test account failed');
}
const userId = signed.data.user.id;
const member = await ok(writer.from('orgs_members').select('org_id').eq('user_id', userId).eq('role', 'owner').limit(1).single());
const orgId = member.org_id;

const source = await ok(reader.from('canvases').select('org_id').eq('id', SOURCE_CANVAS).single());
const sourceOrg = source.org_id;
if (sourceOrg === orgId) {
  throw new Error('source canvas is already in the test org');
}

await removePrevious(orgId);

const projectId = randomUUID();
const canvasId = randomUUID();
const ids = new Map([[SOURCE_PROJECT, projectId], [SOURCE_CANVAS, canvasId], [sourceOrg, orgId]]);
const mapId = (old) => ids.get(old) ?? ids.set(old, randomUUID()).get(old);

const nodes = await ok(reader.from('nodes').select('*').eq('canvas_id', SOURCE_CANVAS).is('deleted_at', null));
const links = await ok(reader.from('nodes_connections').select('*').eq('canvas_id', SOURCE_CANVAS).is('deleted_at', null));
const assets = await ok(reader.from('assets').select('*').eq('project_id', SOURCE_PROJECT));
nodes.forEach((n) => mapId(n.id));
assets.forEach((a) => mapId(a.id));
links.forEach((l) => mapId(l.id));

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const remap = (value) => JSON.parse(JSON.stringify(value).replace(UUID, (m) => ids.get(m) ?? m));

await ok(writer.from('projects').insert({ id: projectId, org_id: orgId, name: COPY_NAME, slug: `perf-heavy-${projectId}` }));
await ok(writer.from('canvases').insert({ id: canvasId, org_id: orgId, project_id: projectId, name: COPY_NAME }));

let copiedFiles = 0;
for (const a of assets) {
  if (a.url && !/^https?:/.test(a.url)) {
    const path = remap(a.url);
    const file = await reader.storage.from(BUCKET).download(a.url);
    if (!file.error) {
      const up = await writer.storage.from(BUCKET).upload(path, file.data, { contentType: a.mime_type ?? undefined, upsert: true });
      copiedFiles += up.error ? 0 : 1;
    }
  }
}
const assetRows = assets.map((a) => ({ ...remap({ ...a, embedding: null }), source_node_id: null, embedding: null }));
await chunked('assets', assetRows);

const nodeRows = nodes.map((n) => ({ ...remap(n), actor_kind: 'user', actor_id: userId, lock_actor_kind: null, lock_actor_id: null, lock_agent_key: null, lock_at: null, public_token_hash: null, public_expires_at: null }));
await chunked('nodes', nodeRows);
await chunked('nodes_connections', links.map((l) => ({ ...remap(l), actor_kind: 'user', actor_id: userId })));

const nodeIds = nodes.map((n) => n.id);
let revisions = 0;
for (const table of ['motion_revisions', 'element_revisions']) {
  const all = await reader.from(table).select('*').in('node_id', nodeIds);
  if (all.error) {
    continue;
  }
  const latest = new Map();
  for (const r of all.data) {
    const prev = latest.get(r.node_id);
    if (!prev || r.version > prev.version) {
      latest.set(r.node_id, r);
    }
  }
  const rows = [...latest.values()].map((r) => ({ ...remap({ ...r, id: undefined }), id: undefined, actor_kind: 'user', actor_id: userId, agent_key: null }));
  rows.forEach((r) => delete r.id);
  await chunked(table, rows);
  revisions += rows.length;
}

const info = { orgId, projectId, canvasId, nodes: nodeRows.length, connections: links.length, assets: assetRows.length, files: copiedFiles, revisions };
writeFileSync(OUT, JSON.stringify(info, null, 2));
console.log(info);
