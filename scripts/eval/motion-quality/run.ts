import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { env } from '../../_shims/env-private';
import { createE2eSession, signInE2e, teardownE2eSession, type E2eSession } from '../../../tests/e2e/fixtures/session';
import { analyzeAudio } from '$lib/motion/audio-analysis';
import { UI_KIT } from '$lib/motion/ui-kit/kit';
import { billedUsdInScope, withOrgContext } from '$lib/server/ai-log';
import { judge } from './judge';
import { contactSheet, cuts, duration, grayFrames, judgeFrames, monoSamples, PROBE_SIZE } from './media';
import { beatAlignment, compareRuns, docCuts, edgeDensity, emptyShare, gateBlockingLeft, holdStats, spentUsd, textMinShare, toolErrors, uiLayers, TASTE_AXES, type CaseResult, type Facts } from './score';

const CASES = [
  { name: 'feega', prompt: 'Fammi un trailer motion di feega.app' },
  { name: 'linear', prompt: 'launch video for linear.app' },
  { name: 'stripe', prompt: 'promo for stripe.com payments' },
  { name: 'shop', prompt: 'product video for the snowboards at hydrogen.shop' },
  { name: 'app', prompt: 'promo video for the Things mobile app, culturedcode.com/things' }
];

const EST_CASE_USD = 2.5;
const DEFAULT_CAP_USD = 20;
const DEFAULT_PORT = 5199;
const FORBIDDEN_PORT = 5173;
const TURN_CAP_MS = 40 * 60_000;
const EXPORT_TIMEOUT_MS = 45 * 60_000;
const POLL_MS = 10_000;
const MAX_REPLIES = 3;
const PICK_COUNT = 3;
const FPS = 30;
const OUT_ROOT = join(process.env.HOME!, 'Documents/feega-videos/evals');

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const port = Number(arg('port') ?? DEFAULT_PORT);
const cap = Number(arg('cap') ?? DEFAULT_CAP_USD);
const only = arg('only');
const compare = arg('compare');
const BASE_URL = `http://localhost:${port}`;

const admin = createClient(env.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const kitNames = new Set(Object.values(UI_KIT).map((p) => p.name));

const say = (s: string) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`);

function replyTo(question: string): string {
  return /account|login|log in|credenzial|password|accesso/i.test(question) ? 'Salta: non ho un account di prova, usa il sito pubblico.' : 'Sì, vai pure. Decidi tu il resto.';
}

async function answerCard(page: Page): Promise<string | null> {
  const pick = page.locator('[data-testid="reference-pick"][data-state="waiting"]');
  if (await pick.count()) {
    const candidates = pick.last().locator('[data-testid="pick-candidate"]');
    const n = Math.min(PICK_COUNT, await candidates.count());
    for (let i = 0; i < n; i++) {
      await candidates.nth(i).click();
    }
    await pick.last().locator('[data-testid="pick-go"]').click();
    return `reference pick: first ${n}`;
  }
  const brief = page.locator('[data-testid="brief-go"]');
  if ((await brief.count()) && (await brief.last().isVisible())) {
    await brief.last().click();
    return 'script brief: Build it';
  }
  return null;
}

async function drive(page: Page, agentUrl: string): Promise<void> {
  const start = Date.now();
  let replies = 0;
  while (Date.now() - start < TURN_CAP_MS) {
    await page.waitForTimeout(POLL_MS);
    const answered = await answerCard(page);
    if (answered) {
      say(`  answered ${answered}`);
      continue;
    }
    const r = await page.request.get(agentUrl);
    const running = r.ok() ? Boolean((await r.json()).running) : true;
    if (running) {
      continue;
    }
    const last = (await page.locator('[role="log"] .prose').allInnerTexts()).at(-1)?.trim() ?? '';
    if (!last.endsWith('?') || replies >= MAX_REPLIES) {
      return;
    }
    const reply = replyTo(last);
    say(`  agent asked, replying: ${reply}`);
    const input = page.locator('#chat-composer-input');
    await input.fill(reply);
    await input.press('Enter');
    replies++;
  }
  throw new Error('turn cap reached');
}

async function exportMp4(page: Page, file: string): Promise<void> {
  await page.getByRole('status', { name: /^Saved/ }).waitFor({ timeout: 60_000 }).catch(() => {});
  await page.getByTestId('export-open').click();
  await page.getByTestId('export-mode-video').click();
  await page.getByTestId('export-start').click();
  const dl = page.getByTestId('export-download');
  await dl.waitFor({ timeout: EXPORT_TIMEOUT_MS });
  const [ev] = await Promise.all([page.waitForEvent('download'), dl.click()]);
  await ev.saveAs(file);
}

async function saveAssets(orgId: string, dir: string): Promise<void> {
  const assets = await admin.from('assets').select('*').eq('org_id', orgId);
  writeFileSync(join(dir, 'assets.json'), JSON.stringify(assets.data, null, 1));
  mkdirSync(join(dir, 'assets'), { recursive: true });
  for (const a of assets.data ?? []) {
    const ext = (a.mime_type ?? 'x/bin').split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
    for (const bucket of ['canvas-assets', 'brand-knowledge']) {
      const { data } = await admin.storage.from(bucket).download(a.url);
      if (data) {
        writeFileSync(join(dir, 'assets', `${a.id}.${ext}`), Buffer.from(await data.arrayBuffer()));
      }
    }
  }
}

function videoFacts(video: string, doc: unknown) {
  const seconds = duration(video);
  const cutTimes = doc ? docCuts(doc as never) : cuts(video);
  const holds = holdStats(cutTimes, seconds);
  const densities = grayFrames(video).map((g) => edgeDensity(g, PROBE_SIZE, PROBE_SIZE));
  const audio = monoSamples(video);
  const beats = audio ? analyzeAudio(audio.samples, audio.rate, FPS).beats : [];
  const ui = doc ? uiLayers(doc as never, kitNames) : null;
  return {
    duration: seconds,
    ...holds,
    emptyShare: emptyShare(densities),
    textMinShare: doc ? textMinShare(doc as never) : null,
    recreatedUi: ui?.recreated ?? null,
    kitUi: ui?.kit ?? null,
    beatAlignment: beatAlignment(cutTimes, beats)
  };
}

async function runCase(c: (typeof CASES)[number], out: string, browserPage: () => Promise<Page>): Promise<CaseResult & { judgeUsd: number }> {
  const dir = join(out, c.name);
  mkdirSync(dir, { recursive: true });
  const session: E2eSession = await createE2eSession();
  const t0 = Date.now();
  const pageErrors: string[] = [];
  let judgeUsd = 0;
  try {
    const page = await browserPage();
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await signInE2e(page, session).catch(() => signInE2e(page, session));
    await page.goto(`${BASE_URL}/app/motion`);
    await page.waitForLoadState('networkidle');
    await page.locator('[data-testid="motion-new"] input[name="name"]').fill(c.name);
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForURL(/\/motion\//);
    await page.getByTestId('motion-preview').waitFor();
    await page.waitForLoadState('networkidle');
    const nodeId = page.url().split('/motion/')[1].split(/[?#/]/)[0];
    const input = page.locator('#chat-composer-input');
    await input.fill(c.prompt);
    await input.press('Enter');
    say(`  sent; node ${nodeId}`);
    await drive(page, `/api/v1/projects/${session.projectId}/motion/${nodeId}/agent`);
    const wallS = (Date.now() - t0) / 1000;
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: join(dir, 'editor.png') });

    const msgs = (await admin.from('chat_messages').select('*').eq('org_id', session.orgId).order('seq')).data ?? [];
    writeFileSync(join(dir, 'chat_messages.json'), JSON.stringify(msgs, null, 1));
    const calls = (await admin.from('ai_calls').select('*').eq('org_id', session.orgId)).data ?? [];
    writeFileSync(join(dir, 'ai_calls.json'), JSON.stringify(calls, null, 1));
    const rev = await admin.from('motion_revisions').select('version, doc').eq('org_id', session.orgId).eq('node_id', nodeId).order('version', { ascending: false }).limit(1).maybeSingle();
    const doc = rev.data?.doc ?? null;
    writeFileSync(join(dir, 'doc.json'), JSON.stringify(doc, null, 1));
    await saveAssets(session.orgId, dir);

    const video = join(dir, 'video.mp4');
    await exportMp4(page, video).catch(async (e) => {
      say(`  export failed: ${e}`);
      await page.screenshot({ path: join(dir, 'export-failure.png') });
    });
    writeFileSync(join(dir, 'page-errors.txt'), pageErrors.join('\n'));
    const base = { gateBlockingLeft: gateBlockingLeft(msgs), toolErrors: toolErrors(msgs), pageErrors: pageErrors.length, costUsd: spentUsd(calls), wallS };
    if (!existsSync(video)) {
      const facts: Facts = { exists: false, duration: null, scenes: null, meanHold: null, maxHold: null, emptyShare: null, textMinShare: null, recreatedUi: null, kitUi: null, beatAlignment: null, ...base };
      return { name: c.name, prompt: c.prompt, unrun: null, facts, taste: null, judgeUsd };
    }
    const facts: Facts = { exists: true, ...videoFacts(video, doc), ...base };
    contactSheet(video, facts.duration ?? 0, join(dir, 'contact-sheet.jpg'));
    const frames = judgeFrames(video, facts.duration ?? 0, join(dir, 'frames'));
    const taste = await withOrgContext(session.orgId, async () => {
      const t = await judge(frames, c.prompt).catch((e) => {
        say(`  judge failed: ${e}`);
        return null;
      });
      judgeUsd = billedUsdInScope() ?? 0;
      return t;
    });
    return { name: c.name, prompt: c.prompt, unrun: null, facts, taste, judgeUsd };
  } finally {
    await teardownE2eSession(session).catch((e) => say(`  TEARDOWN FAILED ${session.orgId}: ${e}`));
  }
}

const fmt = (v: unknown, digits = 2) => (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(digits)) : v === null || v === undefined ? '—' : String(v));
const signed = (v: number | undefined) => (v === undefined ? '' : ` (${v >= 0 ? '+' : ''}${fmt(v)})`);

function report(stamp: string, results: CaseResult[], previous: CaseResult[] | null, totalUsd: number): string {
  const deltas = previous ? compareRuns(results, previous) : {};
  const lines = [`# motion eval ${stamp}`, '', `Total spend $${totalUsd.toFixed(2)}${previous ? `; deltas vs ${compare}` : ''}.`, ''];
  const unrun = results.filter((r) => r.unrun);
  if (unrun.length) {
    lines.push('## unrun', '', ...unrun.map((r) => `- ${r.name}: ${r.unrun}`), '');
  }
  for (const r of results.filter((x) => !x.unrun)) {
    lines.push(`## ${r.name}`, '', `Prompt: "${r.prompt}"`, '', '| fact | value |', '|---|---|');
    for (const [k, v] of Object.entries(r.facts ?? {})) {
      lines.push(`| ${k} | ${fmt(v)}${signed(deltas[r.name]?.[k as keyof Facts])} |`);
    }
    lines.push('', '| taste | score | reason |', '|---|---|---|');
    for (const axis of TASTE_AXES) {
      lines.push(`| ${axis} | ${r.taste ? r.taste[axis].score : '—'} | ${r.taste?.[axis].reason ?? 'judge unrun'} |`);
    }
    lines.push('');
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
  const child = spawn('npx', ['vite', 'dev', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true });
  for (let i = 0; i < 90 && !(await serverUp()); i++) {
    await new Promise((r) => setTimeout(r, 1000));
  }
  return child;
}

async function main() {
  if (port === FORBIDDEN_PORT) {
    throw new Error(`port ${FORBIDDEN_PORT} is the shared dev server: pass --port=<other>`);
  }
  const chosen = CASES.filter((c) => !only || c.name === only);
  if (!chosen.length) {
    throw new Error(`no case ${only}: ${CASES.map((c) => c.name).join(', ')}`);
  }
  const estimate = chosen.length * EST_CASE_USD;
  console.log(`estimated cost $${estimate.toFixed(2)} for ${chosen.length} case(s), cap $${cap}`);
  if (estimate > cap) {
    throw new Error(`estimate over the cap: raise --cap or use --only`);
  }
  const previous = compare ? (JSON.parse(readFileSync(join(compare, 'results.json'), 'utf8')).results as CaseResult[]) : null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const out = join(OUT_ROOT, stamp);
  mkdirSync(out, { recursive: true });

  const server = await startServer();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const results: CaseResult[] = [];
  let total = 0;
  try {
    for (const c of chosen) {
      if (total >= cap) {
        results.push({ name: c.name, prompt: c.prompt, unrun: `budget cap $${cap} reached`, facts: null, taste: null });
        continue;
      }
      say(`case ${c.name}`);
      const context = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
      try {
        const r = await runCase(c, out, () => context.newPage());
        total += (r.facts?.costUsd ?? 0) + r.judgeUsd;
        results.push({ name: r.name, prompt: r.prompt, unrun: r.unrun, facts: r.facts, taste: r.taste });
      } catch (e) {
        results.push({ name: c.name, prompt: c.prompt, unrun: `failed: ${e instanceof Error ? e.message : String(e)}`, facts: null, taste: null });
      } finally {
        await context.close();
      }
      writeFileSync(join(out, 'results.json'), JSON.stringify({ stamp, totalUsd: total, results }, null, 1));
    }
  } finally {
    await browser.close();
    if (server?.pid) {
      process.kill(-server.pid);
    }
  }
  writeFileSync(join(out, 'report.md'), report(stamp, results, previous, total));
  console.log(readFileSync(join(out, 'report.md'), 'utf8'));
  console.log(`\n${out}`);
}

await main();
