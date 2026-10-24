import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, openSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createClient } from '@supabase/supabase-js';
import { env } from '../_shims/env-private';
import { createE2eSession, teardownE2eSession, type E2eSession } from '../../tests/e2e/fixtures/session';

enum Arm {
  Proxy = 'proxy',
  Direct = 'direct',
  Load = 'load'
}

type Doc = { durationInFrames: number; fps: number; background?: unknown; tracks: { clips: { id: string; name?: string; component: string; props: Record<string, unknown>; keyframes?: Record<string, unknown[]> }[] }[] };

type Case = { name: string; prompt: (frameId: string) => string; done: (doc: Doc, nodes: { type: string }[]) => boolean };

const FORBIDDEN_PORT = 5173;
const MODEL = 'anthropic/claude-sonnet-5.5';
const SEED_TITLE = 'Hello world';
const CAP_USD = Number(process.argv.find((a) => a.startsWith('--cap='))?.slice(6) ?? 12);
const PORT = Number(process.argv.find((a) => a.startsWith('--port='))?.slice(7) ?? 5199);
const ARMS = (process.argv.find((a) => a.startsWith('--arms='))?.slice(7) ?? 'proxy,direct,load').split(',') as Arm[];
const ONLY = process.argv.find((a) => a.startsWith('--only='))?.slice(7)?.split(',');
const BASE_URL = `http://localhost:${PORT}`;
const OUT = join(homedir(), 'Documents/feega-videos/evals', `tool-loading-${new Date().toISOString().replace(/[:.]/g, '-')}`);

const clips = (doc: Doc) => doc.tracks.flatMap((t) => t.clips);
const texts = (doc: Doc) => clips(doc).map((c) => String(c.props.text ?? ''));
const animated = (c: Doc['tracks'][number]['clips'][number]) => Object.values(c.keyframes ?? {}).some((k) => k.length > 1) || JSON.stringify(c).includes('"keyframes":{"');

const CASES: Case[] = [
  {
    name: 'title-fade',
    prompt: (id) => `In frame ${id}, add a second text that says "Launch day" and make it fade in over the first second.`,
    done: (doc) => clips(doc).some((c) => String(c.props.text ?? '').includes('Launch day') && animated(c))
  },
  {
    name: 'background',
    prompt: (id) => `Make the background of frame ${id} dark navy, #0b1b3a.`,
    done: (doc) => JSON.stringify(doc.background ?? '').toLowerCase().includes('0b1b3a')
  },
  {
    name: 'star',
    prompt: (id) => `Add a yellow five-point star in the centre of frame ${id}.`,
    done: (doc) => clips(doc).some((c) => c.component === 'Shape' && JSON.stringify(c.props).includes('star'))
  },
  {
    name: 'rename',
    prompt: (id) => `In frame ${id}, rename the "${SEED_TITLE}" text layer to "Headline".`,
    done: (doc) => clips(doc).some((c) => c.name === 'Headline')
  },
  {
    name: 'duration',
    prompt: (id) => `Make frame ${id} exactly 6 seconds long.`,
    done: (doc) => Math.abs(doc.durationInFrames / doc.fps - 6) < 0.05
  },
  {
    name: 'arrow',
    prompt: () => 'Draw an arrow on the open canvas, from x 0 y 900 to x 600 y 900 (canvas units).',
    done: (_doc, nodes) => nodes.filter((n) => n.type === 'element').length > 0
  }
];

const admin = createClient(env.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

async function serverUp(): Promise<boolean> {
  return fetch(`${BASE_URL}/api/v1/version`).then((r) => r.status < 500, () => false);
}

async function startServer(arm: Arm): Promise<ChildProcess> {
  const log = openSync(join(OUT, `server-${arm}.log`), 'a');
  const child = spawn('npx', ['vite', 'dev', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', log, log], detached: true, env: { ...process.env, TOOL_LOADING: arm } });
  for (let i = 0; i < 120 && !(await serverUp()); i++) {
    await new Promise((r) => setTimeout(r, 1000));
  }
  return child;
}

function stopServer(child: ChildProcess) {
  try {
    process.kill(-child.pid!, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

async function bearerOf(session: E2eSession): Promise<string> {
  const user = createClient(env.PUBLIC_SUPABASE_URL!, env.PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await user.auth.signInWithPassword({ email: session.email, password: session.password });
  if (!signed.data.session) {
    throw new Error(`sign-in failed: ${signed.error?.message}`);
  }
  return signed.data.session.access_token;
}

async function edit(bearer: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}/api/v1/edit`, { method: 'POST', headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return (await res.json()) as Record<string, unknown>;
}

async function seedFrame(bearer: string, session: E2eSession): Promise<string> {
  const drawn = await edit(bearer, { project_id: session.projectId, op: 'draw_frame', input: { canvasId: session.canvasId, x: 0, y: 0, w: 640, format: '16:9' } });
  const frameId = String(drawn.frame_id ?? drawn.frameId ?? (drawn.result as Record<string, unknown> | undefined)?.frame_id ?? '');
  if (!frameId) {
    throw new Error(`draw_frame answered ${JSON.stringify(drawn)}`);
  }
  await edit(bearer, { project_id: session.projectId, op: 'add_clip', target: frameId, input: { component: 'Title', start: 0, duration: 3, props: { text: SEED_TITLE } } });
  return frameId;
}

async function headDoc(session: E2eSession, frameId: string): Promise<Doc> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('org_id', session.orgId).eq('node_id', frameId).order('version', { ascending: false }).limit(1).maybeSingle();
  return (data?.doc ?? { durationInFrames: 0, fps: 30, tracks: [] }) as Doc;
}

type Facts = { arm: Arm; case: string; done: boolean; failed: string | null; steps: number; tools: string[]; loads: number; finds: number; describes: number; errors: number; costUsd: number; inputTokens: number; cachedTokens: number; ms: number };

async function chat(bearer: string, session: E2eSession, frameId: string, prompt: string) {
  const res = await fetch(`${BASE_URL}/api/v1/projects/${session.projectId}/agent`, {
    method: 'POST',
    headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
    body: JSON.stringify({ message: prompt, model: MODEL, canvasId: session.canvasId, frame: { nodeId: frameId, selection: [], playhead: 0 } })
  });
  const body = await res.text();
  const parts = body.split('\n').filter((l) => l.startsWith('data: ') && l !== 'data: [DONE]').flatMap((l) => {
    try {
      return [JSON.parse(l.slice(6)) as { type: string; toolName?: string }];
    } catch {
      return [];
    }
  });
  return {
    status: res.status,
    steps: parts.filter((p) => p.type === 'finish-step').length,
    tools: parts.filter((p) => p.type === 'tool-input-available').map((p) => p.toolName ?? ''),
    errors: parts.filter((p) => p.type === 'tool-output-error' || (p.type === 'tool-output-available' && JSON.stringify(p).includes('"error"'))).length,
    failed: res.ok ? (parts.find((p) => p.type === 'error') as { errorText?: string } | undefined)?.errorText ?? null : `HTTP ${res.status}: ${body.slice(0, 200)}`
  };
}

async function settledCost(session: E2eSession, since: string): Promise<{ usd: number; input: number; cached: number }> {
  for (let i = 0; i < 30; i++) {
    const { data } = await admin.from('ai_calls').select('cost_usd, prompt_tokens, cached_tokens, operation').eq('org_id', session.orgId).eq('actor_id', session.userId).gte('created_at', since);
    const rows = (data ?? []) as { cost_usd: number | null; prompt_tokens: number | null; cached_tokens: number | null; operation: string }[];
    if (rows.some((r) => r.operation === 'project-agent')) {
      return rows.reduce((s, r) => ({ usd: s.usd + Number(r.cost_usd ?? 0), input: s.input + Number(r.prompt_tokens ?? 0), cached: s.cached + Number(r.cached_tokens ?? 0) }), { usd: 0, input: 0, cached: 0 });
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { usd: Number.NaN, input: 0, cached: 0 };
}

async function runCase(arm: Arm, c: Case): Promise<Facts> {
  const session = await createE2eSession({ withCredits: true });
  try {
    const bearer = await bearerOf(session);
    const frameId = await seedFrame(bearer, session);
    const since = new Date().toISOString();
    const t0 = Date.now();
    const ran = await chat(bearer, session, frameId, c.prompt(frameId));
    const ms = Date.now() - t0;
    const cost = await settledCost(session, since);
    const { data: nodes } = await admin.from('nodes').select('type').eq('org_id', session.orgId).eq('canvas_id', session.canvasId).is('deleted_at', null);
    const doc = await headDoc(session, frameId);
    const count = (name: string) => ran.tools.filter((t) => t === name).length;
    return { arm, case: c.name, done: c.done(doc, nodes ?? []), failed: ran.failed, steps: ran.steps, tools: ran.tools, loads: count('load_tools'), finds: count('find_tools') + count('list_frame_tools'), describes: count('describe_frame_tool'), errors: ran.errors, costUsd: cost.usd, inputTokens: cost.input, cachedTokens: cost.cached, ms };
  } finally {
    await teardownE2eSession(session);
  }
}

function summary(rows: Facts[]) {
  return ARMS.map((arm) => {
    const mine = rows.filter((r) => r.arm === arm);
    const sum = (f: (r: Facts) => number) => mine.reduce((s, r) => s + f(r), 0);
    return { arm, done: `${mine.filter((r) => r.done).length}/${mine.length}`, costUsd: Number(sum((r) => r.costUsd).toFixed(4)), steps: sum((r) => r.steps), errors: sum((r) => r.errors), loads: sum((r) => r.loads), inputTokens: sum((r) => r.inputTokens), cachedTokens: sum((r) => r.cachedTokens), seconds: Math.round(sum((r) => r.ms) / 1000) };
  });
}

async function main() {
  if (PORT === FORBIDDEN_PORT) {
    throw new Error(`port ${FORBIDDEN_PORT} is the shared dev server: pass --port=<other>`);
  }
  mkdirSync(OUT, { recursive: true });
  const cases = CASES.filter((c) => !ONLY || ONLY.includes(c.name));
  const rows: Facts[] = [];
  const unrun: string[] = [];

  for (const arm of ARMS) {
    if (await serverUp()) {
      throw new Error(`port ${PORT} is busy: the arm needs its own server with TOOL_LOADING=${arm}`);
    }
    const server = await startServer(arm);
    try {
      for (const c of cases) {
        const spent = rows.reduce((s, r) => s + (Number.isFinite(r.costUsd) ? r.costUsd : 0), 0);
        if (spent >= CAP_USD) {
          unrun.push(`${arm}/${c.name}: cap $${CAP_USD} reached`);
          continue;
        }
        const facts = await runCase(arm, c).catch((e) => (unrun.push(`${arm}/${c.name}: ${e instanceof Error ? e.message : e}`), null));
        if (facts) {
          rows.push(facts);
          console.log(JSON.stringify(facts));
        }
        if (facts?.failed) {
          throw new Error(`${arm}/${c.name} failed, stopping before more spend: ${facts.failed}`);
        }
      }
    } finally {
      stopServer(server);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  const report = { model: MODEL, unrun, summary: summary(rows), rows };
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ unrun, summary: report.summary }, null, 2));
  console.log(`report: ${join(OUT, 'report.json')}`);
}

await main();
process.exit();
