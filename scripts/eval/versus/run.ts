import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { env } from '../../_shims/env-private';
import { createE2eSession, teardownE2eSession } from '../../../tests/e2e/fixtures/session';
import { billedUsdInScope, withOrgContext } from '$lib/server/ai-log';
import { claimPort, serverEnv } from '../motion-quality/drive';
import { say } from '../motion-quality/editor';
import { contactSheet, judgeFrames } from '../motion-quality/media';
import { BRIEFS, Loop, briefText, makeFixtures, type Brief } from './briefs';
import { videoFacts, MISSING, SEAM_RATIO_OK, type VideoFacts } from './facts';
import { FEEGA_RESULT, FEEGA_VIDEO, runFeega, type FeegaResult } from './feega';
import { Arm, Outcome, PlainRan, byForfeit, judgePair, settle, toArms, type ArmVerdict, type Shots } from './judge';
import { readPlain, type Usage } from './plain-result';

const DEFAULT_PORT = 5199;
const FORBIDDEN_PORT = 5173;
const DEFAULT_CAP_USD = 15;
const OUT_ROOT = join(process.env.HOME!, 'Documents/feega-videos/evals');
const COMPARE_HEIGHT = 960;

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const port = Number(arg('port') ?? DEFAULT_PORT);
const cap = Number(arg('cap') ?? DEFAULT_CAP_USD);
const only = arg('only');
const BASE_URL = `http://localhost:${port}`;

const admin = createClient(env.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

type ArmReport = { video: string | null; facts: VideoFacts; usage: Usage | null; wallS: number | null; failure: string | null };

type BriefReport = { name: string; brief: string; unrun: string | null; plain: ArmReport | null; feega: ArmReport | null; outcome: Outcome | null; verdicts: ArmVerdict[]; firstArm: Arm | null; comparison: string | null; seamOk: Record<Arm, boolean | null> | null };

const facts = (video: string | null) => (video ? videoFacts(video) : MISSING);

function shots(video: string, seconds: number, dir: string): Shots {
  const sheet = join(dir, 'contact-sheet.jpg');
  contactSheet(video, seconds, sheet);
  return { sheet, frames: judgeFrames(video, seconds, join(dir, 'frames')) };
}

function compareVideo(plain: string, feega: string, file: string): string | null {
  const scale = `scale=-2:${COMPARE_HEIGHT},setsar=1,fps=30`;
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', plain, '-i', feega, '-filter_complex', `[0:v]${scale}[a];[1:v]${scale}[b];[a][b]hstack=inputs=2`, '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', file]);
  return r.status === 0 ? file : null;
}

async function feegaArm(brief: Brief, fixtures: string, dir: string, browser: Awaited<ReturnType<typeof chromium.launch>>): Promise<FeegaResult> {
  const saved = join(dir, FEEGA_RESULT);
  if (existsSync(saved)) {
    say(`  feega: reusing ${saved}`);
    return JSON.parse(readFileSync(saved, 'utf8')) as FeegaResult;
  }
  const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  try {
    const r = await runFeega(brief, fixtures, dir, context, admin, BASE_URL);
    writeFileSync(saved, JSON.stringify(r, null, 1));
    return r;
  } finally {
    await context.close();
  }
}

async function judgeBrief(brief: Brief, dir: string, plain: ArmReport, feega: ArmReport, orgId: string): Promise<{ verdicts: ArmVerdict[]; firstArm: Arm; usd: number }> {
  const s: Record<Arm, Shots> = { [Arm.Plain]: shots(plain.video!, plain.facts.duration ?? 0, join(dir, 'judge-plain')), [Arm.Feega]: shots(feega.video!, feega.facts.duration ?? 0, join(dir, 'judge-feega')) };
  const firstArm = Math.random() < 0.5 ? Arm.Plain : Arm.Feega;
  const secondArm = firstArm === Arm.Plain ? Arm.Feega : Arm.Plain;
  return withOrgContext(orgId, async () => {
    const one = toArms(await judgePair(briefText(brief), s[firstArm], s[secondArm]), firstArm);
    const two = toArms(await judgePair(briefText(brief), s[secondArm], s[firstArm]), secondArm);
    return { verdicts: [one, two], firstArm, usd: billedUsdInScope() ?? 0 };
  });
}

const seam = (f: VideoFacts) => (f.loopSeam === null ? null : f.loopSeam <= SEAM_RATIO_OK);

async function runBrief(brief: Brief, out: string, fixtures: string, browser: Awaited<ReturnType<typeof chromium.launch>>, judgeOrg: string): Promise<{ report: BriefReport; usd: number }> {
  const dir = join(out, brief.name);
  mkdirSync(dir, { recursive: true });
  say(`brief ${brief.name}`);
  const a = readPlain(dir);
  const plain: ArmReport = { video: a.video, usage: a.usage, wallS: a.wallS, failure: a.failure, facts: facts(a.video) };
  const b = await feegaArm(brief, fixtures, dir, browser);
  const feegaVideo = b.video ? join(dir, FEEGA_VIDEO) : null;
  const feega: ArmReport = { video: feegaVideo, facts: facts(feegaVideo), usage: b.usage, wallS: b.wallS, failure: b.failure };
  const base = { name: brief.name, brief: briefText(brief), unrun: a.ran ? null : a.failure, plain, feega, seamOk: brief.loop === Loop.Asked ? { [Arm.Plain]: seam(plain.facts), [Arm.Feega]: seam(feega.facts) } : null };
  const forfeit = byForfeit({ [Arm.Plain]: Boolean(plain.video), [Arm.Feega]: Boolean(feega.video) }, a.ran ? PlainRan.Yes : PlainRan.Never);
  if (forfeit) {
    return { report: { ...base, outcome: forfeit, verdicts: [], firstArm: null, comparison: null }, usd: b.usage.costUsd };
  }
  const comparison = compareVideo(plain.video!, feega.video!, join(dir, 'compare-plain-left-feega-right.mp4'));
  const judged = await judgeBrief(brief, dir, plain, feega, judgeOrg).catch((e) => {
    say(`  judge failed: ${e}`);
    return null;
  });
  const outcome = judged ? settle(judged.verdicts[0], judged.verdicts[1]) : null;
  return { report: { ...base, outcome, verdicts: judged?.verdicts ?? [], firstArm: judged?.firstArm ?? null, comparison }, usd: b.usage.costUsd + (judged?.usd ?? 0) };
}

const fmt = (v: unknown) => (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : v === null || v === undefined ? '—' : String(v));

const ratio = (f: number, p: number) => (p > 0 ? fmt(f / p) : '—');

function totals(reports: BriefReport[], arm: Arm): Usage {
  const usages = reports.map((r) => r[arm]?.usage).filter((u): u is Usage => Boolean(u));
  const sum = (k: keyof Usage) => usages.reduce((s, u) => s + u[k], 0);
  return { inputTokens: sum('inputTokens'), outputTokens: sum('outputTokens'), cacheReadTokens: sum('cacheReadTokens'), cacheWriteTokens: sum('cacheWriteTokens'), costUsd: sum('costUsd') };
}

const tokens = (u: Usage | null | undefined) => (u ? u.inputTokens + u.outputTokens + u.cacheReadTokens + u.cacheWriteTokens : null);

function report(stamp: string, reports: BriefReport[], spent: number): string {
  const tally = (o: Outcome) => reports.filter((r) => r.outcome === o).length;
  const p = totals(reports, Arm.Plain);
  const f = totals(reports, Arm.Feega);
  const lines = [`# versus ${stamp}`, '', `feega wins ${tally(Outcome.FeegaWins)}, plain wins ${tally(Outcome.PlainWins)}, ties ${tally(Outcome.Tie)}, inconsistent ${tally(Outcome.Inconsistent)}. Harness spend (feega arm + judge) $${spent.toFixed(2)}.`, '', `Tokens feega/plain ${ratio(tokens(f)!, tokens(p)!)} (${tokens(f)} / ${tokens(p)}); cost feega/plain ${ratio(f.costUsd, p.costUsd)} ($${f.costUsd.toFixed(2)} / $${p.costUsd.toFixed(2)}).`, ''];
  const unrun = reports.filter((r) => r.unrun);
  if (unrun.length) {
    lines.push('## unrun', '', ...unrun.map((r) => `- ${r.name}: ${r.unrun}`), '');
  }
  lines.push('| brief | outcome | plain | feega | plain tokens | feega tokens | plain $ | feega $ |', '|---|---|---|---|---|---|---|---|');
  for (const r of reports) {
    lines.push(`| ${r.name} | ${r.outcome ?? '—'} | ${r.plain?.failure ?? 'video'} | ${r.feega?.failure ?? 'video'} | ${fmt(tokens(r.plain?.usage))} | ${fmt(tokens(r.feega?.usage))} | ${fmt(r.plain?.usage?.costUsd)} | ${fmt(r.feega?.usage?.costUsd)} |`);
  }
  for (const r of reports.filter((x) => x.plain || x.feega)) {
    lines.push('', `## ${r.name}`, '', `Brief: ${r.brief}`, '', '| fact | plain | feega |', '|---|---|---|');
    for (const k of Object.keys(MISSING) as Array<keyof VideoFacts>) {
      lines.push(`| ${k} | ${fmt(r.plain?.facts[k])} | ${fmt(r.feega?.facts[k])} |`);
    }
    lines.push(`| wallS | ${fmt(r.plain?.wallS)} | ${fmt(r.feega?.wallS)} |`);
    if (r.seamOk) {
      lines.push(`| seam ok | ${fmt(r.seamOk.plain)} | ${fmt(r.seamOk.feega)} |`);
    }
    for (const [i, v] of r.verdicts.entries()) {
      lines.push('', `Judge ${i + 1}: winner ${v.winner ?? 'tie'} (fidelity plain ${v.sides.plain.fidelity}, feega ${v.sides.feega.fidelity}; legible plain ${v.sides.plain.legible}, feega ${v.sides.feega.legible}). ${v.reason}`);
    }
    if (r.comparison) {
      lines.push('', `Side by side: ${r.comparison}`);
    }
  }
  return lines.join('\n');
}

async function serverUp(): Promise<boolean> {
  return fetch(BASE_URL).then(() => true, () => false);
}

async function startServer(): Promise<ChildProcess | null> {
  if (await serverUp()) {
    return null;
  }
  const child = spawn('npx', ['vite', 'dev', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true, env: { ...process.env, ...serverEnv(BASE_URL, chromium.executablePath()) } });
  for (let i = 0; i < 90 && !(await serverUp()); i++) {
    await new Promise((r) => setTimeout(r, 1000));
  }
  return child;
}

async function main() {
  if (port === FORBIDDEN_PORT) {
    throw new Error(`port ${FORBIDDEN_PORT} is the shared dev server: pass --port=<other>`);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const out = resolve(arg('out') ?? join(OUT_ROOT, `versus-${stamp}`));
  const fixtures = join(out, 'fixtures');
  await makeFixtures(fixtures);
  const release = claimPort(port, tmpdir());
  const server = await startServer();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const judge = await createE2eSession();
  const reports: BriefReport[] = [];
  let spent = 0;
  try {
    for (const brief of BRIEFS) {
      const skipped = only && !only.split(',').includes(brief.name) ? `not in --only=${only}` : spent >= cap ? `budget cap $${cap} reached` : null;
      if (skipped) {
        reports.push({ name: brief.name, brief: briefText(brief), unrun: skipped, plain: null, feega: null, outcome: null, verdicts: [], firstArm: null, comparison: null, seamOk: null });
        continue;
      }
      const r = await runBrief(brief, out, fixtures, browser, judge.orgId);
      spent += r.usd;
      reports.push(r.report);
      writeFileSync(join(out, 'report.json'), JSON.stringify({ stamp, spentUsd: spent, reports }, null, 1));
    }
  } finally {
    writeFileSync(join(out, 'report.json'), JSON.stringify({ stamp, spentUsd: spent, reports }, null, 1));
    writeFileSync(join(out, 'report.md'), report(stamp, reports, spent));
    await teardownE2eSession(judge).catch((e) => say(`TEARDOWN FAILED ${judge.orgId}: ${e}`));
    await browser.close();
    if (server?.pid) {
      process.kill(-server.pid);
    }
    release();
  }
  console.log(readFileSync(join(out, 'report.md'), 'utf8'));
  console.log(`\n${out}`);
}

await main();
