import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { env } from '../_shims/env-private';
import type { Db } from '$lib/server/db/client';
import { markRlsScoped } from '$lib/server/rls-client';
import { motionSource } from '$lib/server/motion/sources';
import { motionTokens } from '$lib/server/motion/editor';
import { drawFrame, prepare } from '$lib/motion/gpu-full/display-list';
import { loadFonts } from '$lib/motion/gpu-full/text/load';
import { Smoothing } from '$lib/motion/gpu-full/text/painter';
import { posterSecond } from '$lib/motion/poster-capture';
import { histogram, reasonOf, type FrameGaps } from './histogram';

const MOTION = 'motion';
const WHY = process.argv.includes('--why');
const WHY_CHARS = 600;
const DUMP = process.argv.find((a) => a.startsWith('--dump='))?.slice('--dump='.length) ?? null;
if (DUMP) {
  mkdirSync(DUMP, { recursive: true });
}
const fixture = JSON.parse(readFileSync(new URL('../../tests/e2e/fixtures/heavy-canvas-landings.json', import.meta.url), 'utf8')) as { projectId: string; canvasId: string; landings: { key: string; desktop: { nodeId: string }; mobile: { nodeId: string } }[] };
const landingIds = new Set(fixture.landings.flatMap((l) => [l.desktop.nodeId, l.mobile.nodeId]));

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const db = markRlsScoped(createClient(env.PUBLIC_SUPABASE_URL!, env.PUBLIC_SUPABASE_ANON_KEY!, options) as unknown as Db);
const signed = await db.auth.signInWithPassword({ email: env.E2E_TEST_EMAIL!, password: env.E2E_TEST_PASSWORD! });
if (signed.error) {
  throw new Error(signed.error.message);
}

const project = await db.from('projects').select('org_id, brand_id').eq('id', fixture.projectId).single();
if (project.error) {
  throw new Error(project.error.message);
}
const orgId = project.data.org_id;
const tokens = await motionTokens(db, { orgId, brandId: project.data.brand_id });

const nodes = await db.from('nodes').select('id, type').eq('canvas_id', fixture.canvasId).is('deleted_at', null);
if (nodes.error) {
  throw new Error(nodes.error.message);
}
const ids = [...new Set([...nodes.data.filter((n) => n.type === MOTION).map((n) => n.id), ...landingIds])];

const frames: FrameGaps[] = [];
for (const nodeId of ids) {
  const source = await motionSource({ db, orgId, projectId: fixture.projectId, canvasId: fixture.canvasId, nodeId });
  if (!source) {
    continue;
  }
  const fonts = await loadFonts(source.doc, source.assets);
  const prepared = prepare(source.doc, tokens, source.assets, { fonts, smoothing: Smoothing.Plain });
  const list = drawFrame(prepared, Math.round(posterSecond(source.doc) * source.doc.fps));
  frames.push({ id: nodeId, gaps: list.unsupported });
  if (DUMP) {
    writeFileSync(join(DUMP, `${nodeId}.json`), JSON.stringify(source.doc));
  }
  const clips = new Map(prepared.doc.tracks.flatMap((t) => t.clips).map((c) => [c.id, c]));
  for (const gap of list.unsupported.filter((g) => WHY && reasonOf(g) !== 'custom')) {
    const clip = clips.get(gap.clip)!;
    console.log(`  ${gap.reason} ${clip.component} ${JSON.stringify({ keyframed: Object.keys(clip.keyframes).filter((k) => clip.keyframes[k].length), props: clip.props }).slice(0, WHY_CHARS)}`);
  }
  const tag = landingIds.has(nodeId) ? ' landing' : '';
  const reasons = [...new Set(list.unsupported.map((g) => `${reasonOf(g)}:${g.component}${g.detail ? ` ${g.detail}` : ''}`))];
  console.log(`${nodeId}${tag} ${list.unsupported.length ? reasons.join(' | ') : 'whole'}`);
}

const blocked = frames.filter((f) => f.gaps.length);
console.log(`\n${frames.length} frames, ${blocked.length} on posters, ${blocked.filter((f) => f.gaps.some((g) => reasonOf(g) !== 'custom')).length} for a non-custom reason\n`);
console.table(histogram(frames));
