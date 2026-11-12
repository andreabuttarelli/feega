import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { RUN_LIMITS, sandboxUsd } from '$lib/server/code-import/sandbox-runner';
import { labelOf } from '$lib/server/code-import/render-conditions';
import { COMPONENT_RULE, CORPUS, OUT_OF_CORPUS, ROUTE_RULE, repoUrl, type CorpusEntry } from './corpus';
import { failureHistogram, scoreRepo, unrunOf, type ImportRun, type Scorecard } from './score';

const OUT_ROOT = join(homedir(), 'Documents/feega-videos/evals/code-import');
const DEFAULT_CAP_USD = 1;
const WORST_REPO_USD = sandboxUsd(RUN_LIMITS.wallMs);
const DRY_RUN = 'dry run';
const FORBIDDEN_ORIGIN = 'localhost:5173';

const flag = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const spend = process.argv.includes('--spend');
const cap = Number(flag('cap') ?? DEFAULT_CAP_USD);
const only = flag('repo');
const compareDir = flag('compare');

const picked = only ? CORPUS.filter((e) => e.name === only || e.repo === only) : CORPUS;

const NOT_LANDED = 'not_landed';

async function discovered(entry: CorpusEntry): Promise<string[] | null> {
  const query = new URLSearchParams({ repo: repoUrl(entry), ...(entry.app ? { app: entry.app } : {}) });
  const res = await fetch(`${process.env.FEEGA_URL}/api/v1/projects/${process.env.FEEGA_PROJECT_ID}/code-import/routes?${query}`, { headers: { authorization: `Bearer ${process.env.FEEGA_API_KEY}` } }).catch(() => null);
  const body = res?.ok ? await res.json().catch(() => null) : null;
  return Array.isArray(body?.routes) ? body.routes.map((r: { path: string }) => r.path) : null;
}

async function imported(entry: CorpusEntry): Promise<ImportRun> {
  const base = process.env.FEEGA_URL!;
  const started = Date.now();
  const res = await fetch(`${base}/api/v1/projects/${process.env.FEEGA_PROJECT_ID}/code-import`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.FEEGA_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ canvasId: process.env.FEEGA_CANVAS_ID, repo: repoUrl(entry), routes: entry.routes, conditions: entry.conditions, designSystem: true, x: 0, y: 0 })
  });
  const ms = Date.now() - started;
  const body = await res.json().catch(() => ({}));
  const common = { discovered: await discovered(entry), uses: null, fidelity: null, phases: { request: ms }, sandboxMs: ms };

  if (!res.ok) {
    return { ...common, boot: { ok: false, failure: body.error ?? `http_${res.status}`, detail: body.detail ?? '' }, routes: [], components: null, variants: null, instances: null, tokens: null, bound: null };
  }

  const landed = new Set<string>(body.pages ?? []);
  const routes = entry.routes.flatMap((route) => entry.conditions.map((c) => labelOf(route, c))).map((label) => ({ route: label, condition: label, ok: landed.has(label), ...(landed.has(label) ? {} : { failure: NOT_LANDED }) }));
  return { ...common, boot: { ok: true, installMs: null, readyMs: null }, routes, components: body.components, variants: body.variants, instances: body.instances, tokens: body.design?.tokens ?? null, bound: body.design ?? null };
}

function spendRefusal(): string | null {
  const missing = ['FEEGA_URL', 'FEEGA_API_KEY', 'FEEGA_PROJECT_ID', 'FEEGA_CANVAS_ID'].filter((k) => !process.env[k]);
  if (missing.length) {
    return `missing ${missing.join(', ')}`;
  }
  if (process.env.FEEGA_URL!.includes(FORBIDDEN_ORIGIN)) {
    return 'port 5173 is not used for evals';
  }
  const worst = picked.length * WORST_REPO_USD;
  return worst > cap ? `worst case $${worst.toFixed(2)} passes cap $${cap}` : null;
}

const fmt = (m: Record<string, unknown>) => ('unrun' in m ? `unrun: ${m.unrun}` : typeof m.value === 'number' ? m.value.toFixed(3) : String(m.value));

function summary(cards: Scorecard[], refused: string | null): string {
  const lines = ['# Code import scorecard', '', `Route rule: ${ROUTE_RULE}`, '', `Component rule: ${COMPONENT_RULE}`, '', '## unrun', ''];
  for (const card of cards) {
    lines.push(...unrunOf(card).map((u) => `- ${card.name} · ${u.metric}: ${u.reason}`));
  }
  lines.push(...OUT_OF_CORPUS.map((o) => `- ${o.name}: ${o.unrun}`));
  if (refused) {
    lines.push(`- spend refused: ${refused}`);
  }
  lines.push('', '## results', '');
  for (const card of cards) {
    lines.push(`### ${card.name} (${card.repo}@${card.sha.slice(0, 7)})`, '', ...Object.entries(card.metrics).map(([k, m]) => `- ${k}: ${fmt(m)}`), '');
  }
  lines.push('## failures', '', '```', JSON.stringify(failureHistogram(cards), null, 2), '```', '');
  return lines.join('\n');
}

function compared(cards: Scorecard[], dir: string): string[] {
  return cards.flatMap((card) => {
    const file = join(dir, `${card.name}.json`);
    if (!existsSync(file)) {
      return [`${card.name}: not in ${dir}`];
    }
    const before: Scorecard = JSON.parse(readFileSync(file, 'utf8'));
    return Object.entries(card.metrics).flatMap(([k, m]) => {
      const was = before.metrics[k as keyof Scorecard['metrics']];
      return typeof m.value === 'number' && typeof was?.value === 'number' ? [`${card.name} · ${k}: ${was.value.toFixed(3)} → ${m.value.toFixed(3)}`] : [];
    });
  });
}

async function main() {
  const refused = spend ? spendRefusal() : null;
  const live = spend && !refused;

  console.log(`${live ? 'SPEND' : 'DRY RUN'}: ${picked.length} repos, worst case $${(picked.length * WORST_REPO_USD).toFixed(3)} (cap $${cap}, $${WORST_REPO_USD.toFixed(4)}/repo at ${RUN_LIMITS.wallMs / 60_000} min × ${RUN_LIMITS.vcpus} vCPU)`);
  if (refused) {
    console.log(`spend refused: ${refused}`);
  }
  for (const e of picked) {
    console.log(`- ${e.name}: ${repoUrl(e)} · ${e.routes.length}/${e.expectedRoutes.length} routes × ${e.conditions.length} conditions${e.needs ? ` · needs ${e.needs}` : ''}`);
  }

  const cards: Scorecard[] = [];
  for (const e of picked) {
    cards.push(live ? scoreRepo(e, await imported(e)) : scoreRepo(e, null, refused ? `spend refused: ${refused}` : DRY_RUN));
  }

  const out = join(OUT_ROOT, new Date().toISOString().replace(/[:.]/g, '-'));
  mkdirSync(out, { recursive: true });
  for (const card of cards) {
    writeFileSync(join(out, `${card.name}.json`), JSON.stringify(card, null, 2));
  }
  const text = summary(cards, refused);
  writeFileSync(join(out, 'summary.md'), text);
  appendFileSync(join(OUT_ROOT, 'trend.jsonl'), JSON.stringify({ at: out, live, metrics: Object.fromEntries(cards.map((c) => [c.name, c.metrics])) }) + '\n');

  console.log(`\n${text}`);
  if (compareDir) {
    console.log(['## compare', ...compared(cards, compareDir)].join('\n'));
  }
  console.log(`output: ${out}`);
  console.log(`previous runs: ${readdirSync(OUT_ROOT).filter((d) => d !== 'trend.jsonl').length - 1}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
