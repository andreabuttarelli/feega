import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { chromium, type Page } from 'playwright';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import { env } from '../_shims/env-private';
import { createE2eSession, signInE2e, teardownE2eSession, type E2eSession } from '../../tests/e2e/fixtures/session';

const BASE_URL = env.SOCIAL_CHECK_URL ?? 'http://localhost:5191';
const OUT = join(homedir(), 'Documents/feega-videos/social-refs');
const BUCKET = 'canvas-assets';
const TURN_TIMEOUT_MS = 20 * 60_000;
const POLL_MS = 5000;
const TILE = 240;

const CASES = [
  { name: 'account', message: 'fai un video nello stile di @pentagramdesign su Instagram, per lanciare il nostro nuovo studio di design' },
  { name: 'tiktok', message: 'fai un video con lo stesso ritmo e lo stesso stile di questo TikTok: https://www.tiktok.com/@yourinstapics/video/7364324791668460818' }
];

const admin = createClient(env.PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

type Turn = { messages: unknown[]; running: boolean };

async function motionNode(session: E2eSession): Promise<string> {
  const id = randomUUID();
  const node = await admin.from('nodes').insert({ id, org_id: session.orgId, project_id: session.projectId, canvas_id: session.canvasId, type: 'motion', x: 0, y: 0, data: { format: '9:16', docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null }, actor_kind: 'user', actor_id: session.userId });
  if (node.error) {
    throw new Error(`node: ${node.error.message}`);
  }
  return id;
}

async function runTurn(page: Page, api: string, message: string): Promise<Turn> {
  const status = await page.evaluate(async ({ api, message }) => {
    const res = await fetch(api, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message }) });
    const reader = res.body?.getReader();
    while (reader && !(await reader.read()).done) {
      continue;
    }
    return res.status;
  }, { api, message });
  console.log(`POST ${status}`);
  const t0 = Date.now();
  for (;;) {
    const turn = (await page.evaluate(async (api) => (await fetch(api)).json(), api)) as Turn;
    if (!turn.running || Date.now() - t0 > TURN_TIMEOUT_MS) {
      return turn;
    }
    await page.waitForTimeout(POLL_MS);
  }
}

function unwrapped(output: unknown): unknown {
  if (typeof output === 'string') {
    try {
      return unwrapped(JSON.parse(output));
    } catch {
      return output;
    }
  }
  const o = output as { type?: string; value?: unknown } | null;
  if (o?.type === 'json') {
    return o.value;
  }
  if (o?.type === 'content' && Array.isArray(o.value)) {
    const text = (o.value as { type: string; text?: string }[]).find((v) => v.type === 'text')?.text;
    return text ? JSON.parse(text) : null;
  }
  return output;
}

function toolResults(messages: unknown[]): { tool: string; input: unknown; output: unknown }[] {
  const text = JSON.stringify(messages);
  const parts: { tool: string; input: unknown; output: unknown }[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (!v || typeof v !== 'object') {
      return;
    }
    const o = v as Record<string, unknown>;
    const name = (o.toolName ?? (typeof o.type === 'string' && o.type.startsWith('tool-') ? o.type.slice(5) : undefined)) as string | undefined;
    if (name && ('output' in o || 'input' in o)) {
      parts.push({ tool: name, input: o.input, output: unwrapped(o.output) });
    }
    Object.values(o).forEach(walk);
  };
  walk(JSON.parse(text));
  return parts;
}

async function tile(bytes: Buffer): Promise<Buffer> {
  return sharp(bytes).resize(TILE, TILE, { fit: 'cover' }).jpeg().toBuffer();
}

async function contactSheet(file: string, rows: Buffer[][]): Promise<void> {
  const width = Math.max(1, ...rows.map((r) => r.length)) * TILE;
  const composite = (await Promise.all(rows.map(async (row, y) => Promise.all(row.map(async (b, x) => ({ input: await tile(b), left: x * TILE, top: y * TILE })))))).flat();
  await sharp({ create: { width, height: Math.max(1, rows.length) * TILE, channels: 3, background: '#ffffff' } }).composite(composite).jpeg().toFile(file);
}

const sheeted = new Set<string>();

async function download(path: string): Promise<Buffer | null> {
  const file = await admin.storage.from(BUCKET).download(path);
  return file.data ? Buffer.from(await file.data.arrayBuffer()) : null;
}

async function sheetFor(name: string, session: E2eSession): Promise<void> {
  const root = `${session.orgId}/${session.projectId}/web-views`;
  const calls = ((await admin.storage.from(BUCKET).list(root, { limit: 100 })).data ?? []).map((e) => e.name).filter((c) => !sheeted.has(c));
  const rows: Buffer[][] = [];
  for (const call of calls) {
    sheeted.add(call);
    const files = ((await admin.storage.from(BUCKET).list(`${root}/${call}`, { limit: 100 })).data ?? []).map((e) => e.name).sort();
    const row = (await Promise.all(files.map((f) => download(`${root}/${call}/${f}`)))).filter((b): b is Buffer => b !== null);
    console.log(`${name}: row ${call} = ${files.join(', ')}`);
    rows.push(row);
  }
  await contactSheet(join(OUT, `${name}-contact-sheet.jpg`), rows);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const session = await createE2eSession({ withCredits: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ baseURL: BASE_URL, viewport: { width: 1600, height: 1000 } });
    await signInE2e(page, session).catch(() => signInE2e(page, session));
    for (const c of CASES) {
      const nodeId = await motionNode(session);
      const editor = `/p/${session.projectId}/c/${session.canvasId}/motion/${nodeId}`;
      await page.goto(editor);
      const turn = await runTurn(page, `/api/v1/projects/${session.projectId}/motion/${nodeId}/agent`, c.message);
      writeFileSync(join(OUT, `${c.name}-turn.json`), JSON.stringify(turn, null, 1));
      const results = toolResults(turn.messages);
      console.log(`${c.name}: running=${turn.running}`, results.map((r) => r.tool).join(' → '));
      for (const r of results) {
        console.log(`  ${r.tool} ${JSON.stringify(r.input).slice(0, 160)} => ${JSON.stringify(r.output).slice(0, 300)}`);
      }
      for (const m of turn.messages as { tools?: { toolName: string; output?: unknown }[] }[]) {
        for (const t of m.tools ?? []) {
          const out = t.output as { images?: { path?: string }[]; candidates?: { id: string; preview?: string }[] } | string | undefined;
          const shape = typeof out === 'object' && out ? `images ${out.images?.filter((i) => i.path).length ?? '-'}, previews ${out.candidates ? out.candidates.filter((x) => x.preview).length + '/' + out.candidates.length : '-'}` : typeof out;
          console.log(`  saved ${t.toolName}: ${shape}`);
        }
      }
      await sheetFor(c.name, session);
      await page.goto(editor);
      await page.waitForTimeout(8000);
      await page.screenshot({ path: join(OUT, `${c.name}-editor.png`) });
    }
    const calls = await admin.from('ai_calls').select('provider, cost_usd').eq('org_id', session.orgId);
    if (calls.error) {
      console.log(`ai_calls read failed: ${calls.error.message}`);
    }
    const rows = calls.data ?? [];
    const sum = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
    console.log(`cost: total $${sum(() => true).toFixed(3)}, scrapecreators $${sum((r) => r.provider === 'scrapecreators').toFixed(3)} over ${rows.filter((r) => r.provider === 'scrapecreators').length} calls`);
  } finally {
    await browser.close();
    await teardownE2eSession(session);
    console.log('account, org and storage removed');
  }
}

await main();
