import { createClient } from '@supabase/supabase-js';
import { env } from '../_shims/env-private';
import { createE2eSession, teardownE2eSession } from '../../tests/e2e/fixtures/session';
import { designLayout } from '$lib/server/layouts/design';
import { Outcome } from '$lib/server/repos/effects';
import { bakeComposition, type CompositionProps } from '$lib/motion/hyperframes/composition';

const PROMPT = 'twelve cards on a slowly turning ring that bobs up and down';
const MISSING_TABLE = new Set(['42P01', 'PGRST205']);
const FRAME = { width: 1920, height: 1080, fps: 30 };

const admin = createClient(env.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

const scenarios = new Map([
  ['layout row exists in the workspace', 'unrun'],
  ['its spec bakes a composition with finite frames', 'unrun']
]);

function settle(name: string, ok: boolean, why = '') {
  scenarios.set(name, ok ? 'pass' : `fail: ${why}`);
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}${why ? ` — ${why}` : ''}`);
}

function report(extra: Record<string, unknown>) {
  const unrun = [...scenarios].filter(([, s]) => s === 'unrun').map(([n]) => n);
  console.log(JSON.stringify({ scenarios: Object.fromEntries(scenarios), unrun, ...extra }, null, 2));
}

const probe = await admin.from('layouts').select('id').limit(1);
if (probe.error && MISSING_TABLE.has(probe.error.code ?? '')) {
  report({ reason: 'the layouts table is not migrated on this database (supabase/migrations/20261008200000_layouts.sql)' });
  process.exit(0);
}

const session = await createE2eSession({ withCredits: true });
let cost = 0;
try {
  const user = createClient(env.PUBLIC_SUPABASE_URL!, env.PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  await user.auth.signInWithPassword({ email: session.email, password: session.password });

  const written = await designLayout(user as never, { orgId: session.orgId, userId: session.userId }, PROMPT);
  const row = await admin.from('layouts').select('id, name, spec').eq('org_id', session.orgId).is('deleted_at', null).maybeSingle();
  settle('layout row exists in the workspace', Boolean(row.data), written.outcome === Outcome.Ok ? '' : `${written.outcome}: ${JSON.stringify(written.problems ?? [])}`);

  if (row.data) {
    const props = { layout: 'custom', layoutSpec: row.data.spec, layoutRef: row.data.id, media: [{ assetId: 'a', kind: 'image' }], layoutParams: {}, camera: 'static', cameraParams: {}, background: '#000000', loop: 4 } as unknown as CompositionProps;
    const bake = bakeComposition('comp', props, FRAME, () => 'https://cdn.test/a.png');
    settle('its spec bakes a composition with finite frames', bake.instances.length > 0 && bake.frames.every(Number.isFinite), `${bake.instances.length} instances`);
  }

  const { data } = await admin.from('ai_calls').select('cost_usd').eq('org_id', session.orgId);
  cost = (data ?? []).reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0);
} catch (error) {
  console.error('FAIL:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await teardownE2eSession(session);
  report({ costUsd: Number(cost.toFixed(4)) });
  if ([...scenarios.values()].some((s) => s.startsWith('fail'))) {
    process.exitCode = 1;
  }
  process.exit();
}
