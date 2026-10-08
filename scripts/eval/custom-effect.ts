import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { env } from '../_shims/env-private';
import { createE2eSession, teardownE2eSession, type E2eSession } from '../../tests/e2e/fixtures/session';
import { askMotion, askStatus } from '$lib/server/motion/ask';
import { chromiumFrames } from '$lib/server/motion/chromium-frames';
import { drawFrames } from '$lib/server/motion/server-frames';
import { MotionFormat, newMotionDoc, parseMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { addClip, setProps } from '$lib/motion/timeline';
import { FEEGA_TOKENS } from '$lib/motion/brand';

const MODEL = env.CUSTOM_EFFECT_EVAL_MODEL ?? 'anthropic/claude-sonnet-5.5';
const PROMPT = 'make a VHS effect and put it on clip 1';
const BUCKET = 'canvas-assets';
const POLL_MS = 3000;
const TURN_TIMEOUT_MS = 6 * 60_000;
const MISSING_TABLE = new Set(['42P01', 'PGRST205']);
const SIZE = 640;

const admin = createClient(env.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

const scenarios = new Map([
  ['effect row exists in the workspace', 'unrun'],
  ['its check passed', 'unrun'],
  ['clip 1 references the effect', 'unrun'],
  ['server frame differs from the un-effected frame', 'unrun']
]);

function pass(name: string) {
  scenarios.set(name, 'pass');
  console.log(`PASS: ${name}`);
}

function fail(name: string, why: string) {
  scenarios.set(name, `fail: ${why}`);
  console.log(`FAIL: ${name} — ${why}`);
}

function report(extra: Record<string, unknown>) {
  const unrun = [...scenarios].filter(([, s]) => s === 'unrun').map(([n]) => n);
  console.log(JSON.stringify({ scenarios: Object.fromEntries(scenarios), unrun, ...extra }, null, 2));
}

async function unrunReason(): Promise<string | null> {
  const probe = await admin.from('effects').select('id').limit(1);
  if (probe.error && MISSING_TABLE.has(probe.error.code ?? '')) {
    return 'the effects table is not migrated on this database (supabase/migrations/20261008190000_effects.sql)';
  }
  if (!env.CHROMIUM_PATH) {
    return 'CHROMIUM_PATH is not set: the effect check and server frames need a Chromium';
  }
  return null;
}

async function seedMotion(session: E2eSession): Promise<{ nodeId: string; assetId: string }> {
  const png = await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: { r: 230, g: 120, b: 40 } } }).png().toBuffer();
  const path = `${session.orgId}/${session.projectId}/${randomUUID()}-still.png`;
  await admin.storage.from(BUCKET).upload(path, png, { contentType: 'image/png' });
  const asset = await admin.from('assets').insert({ org_id: session.orgId, project_id: session.projectId, type: 'image', source: 'upload', url: path, mime_type: 'image/png', bytes: png.length }).select('id').single();
  if (asset.error) {
    throw new Error(`asset: ${asset.error.message}`);
  }

  const nodeId = randomUUID();
  const node = await admin.from('nodes').insert({ id: nodeId, org_id: session.orgId, project_id: session.projectId, canvas_id: session.canvasId, type: 'motion', x: 0, y: 0, data: { format: 'square', docHeadRevision: 0 }, actor_kind: 'user', actor_id: session.userId });
  if (node.error) {
    throw new Error(`node: ${node.error.message}`);
  }

  const added = addClip({ ...newMotionDoc(MotionFormat.Square), assets: [{ id: asset.data.id, kind: 'image', name: 'still' }] }, { component: 'Image', from: 0, durationInFrames: 90 }, 'clip1');
  const doc = added.ok ? setProps(added.doc, 'clip1', { assetId: asset.data.id }) : added;
  if (!doc.ok) {
    throw new Error(doc.error);
  }
  const revision = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: nodeId, version: 1, doc: doc.doc, summary: 'eval seed', actor_kind: 'user', actor_id: session.userId });
  if (revision.error) {
    throw new Error(`revision: ${revision.error.message}`);
  }
  return { nodeId, assetId: asset.data.id };
}

async function waitDone(db: never, orgId: string, runId: string): Promise<Record<string, unknown>> {
  const deadline = Date.now() + TURN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const status = (await askStatus(db, { orgId, runId })) as Record<string, unknown>;
    if (status.status === 'done' || status.status === 'failed') {
      return status;
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error('the motion turn did not finish in time');
}

async function spent(orgId: string): Promise<number> {
  const { data } = await admin.from('ai_calls').select('cost_usd').eq('org_id', orgId);
  return (data ?? []).reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0);
}

const reason = await unrunReason();
if (reason) {
  report({ reason });
  process.exit(0);
}

const session = await createE2eSession({ withCredits: true });
let cost = 0;
try {
  const { nodeId, assetId } = await seedMotion(session);
  const user = createClient(env.PUBLIC_SUPABASE_URL!, env.PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  await user.auth.signInWithPassword({ email: session.email, password: session.password });

  const started = await askMotion(user as never, { orgId: session.orgId, userId: session.userId, nodeId, prompt: PROMPT, choice: { model: MODEL } });
  if (started instanceof Response) {
    throw new Error(`ask refused: ${started.status} ${await started.text()}`);
  }
  const status = await waitDone(user as never, session.orgId, started.runId);
  console.log('turn:', JSON.stringify(status).slice(0, 400));

  const effects = await admin.from('effects').select('id, name, check_state, check_problems, cost_ms').eq('org_id', session.orgId).is('deleted_at', null);
  const effect = effects.data?.[0];
  if (effect) {
    pass('effect row exists in the workspace');
    if (effect.check_state === 'passed') {
      pass('its check passed');
    } else {
      fail('its check passed', `${effect.check_state}: ${JSON.stringify(effect.check_problems)}`);
    }
  } else {
    fail('effect row exists in the workspace', 'no row');
  }

  const head = await admin.from('motion_revisions').select('doc').eq('org_id', session.orgId).eq('node_id', nodeId).order('version', { ascending: false }).limit(1).single();
  const parsed = parseMotionDoc(head.data?.doc);
  const doc = parsed.ok ? parsed.doc : null;
  const clip = doc?.tracks.flatMap((t) => t.clips).find((c) => c.id === 'clip1');
  if (clip?.shaders.some((s) => s.ref === effect?.id)) {
    pass('clip 1 references the effect');
  } else {
    fail('clip 1 references the effect', JSON.stringify(clip?.shaders ?? null));
  }

  if (doc && clip?.shaders.length) {
    const signed = await admin.storage.from(BUCKET).createSignedUrl((await admin.from('assets').select('url').eq('id', assetId).single()).data!.url, 600);
    const assets = { [assetId]: signed.data!.signedUrl };
    const plain: MotionDoc = { ...doc, tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, shaders: [] })) })) };
    const [shaded] = await drawFrames(chromiumFrames, { compose: { doc, tokens: FEEGA_TOKENS, assets }, times: [1] });
    const [bare] = await drawFrames(chromiumFrames, { compose: { doc: plain, tokens: FEEGA_TOKENS, assets }, times: [1] });
    if (!shaded.bytes.equals(bare.bytes)) {
      pass('server frame differs from the un-effected frame');
    } else {
      fail('server frame differs from the un-effected frame', 'identical bytes');
    }
  }

  cost = await spent(session.orgId);
} catch (error) {
  console.error('FAIL:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await teardownE2eSession(session);
  report({ model: MODEL, costUsd: Number(cost.toFixed(4)) });
  if ([...scenarios.values()].some((s) => s.startsWith('fail'))) {
    process.exitCode = 1;
  }
  process.exit();
}
