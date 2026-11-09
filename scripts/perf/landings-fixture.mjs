import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync } from 'fflate';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const PROJECT_ID = '00000000-0000-4000-8000-0000000be101';
const CANVAS_ID = '00000000-0000-4000-8000-0000000be102';
const EXPORTED_AT = '2026-11-09T00:00:00.000Z';
const PORT = 5289;
const BASE = `http://127.0.0.1:${PORT}`;
const SITES = ['https://stripe.com', 'https://vercel.com', 'https://supabase.com', 'https://linear.app', 'https://www.notion.com', 'https://www.figma.com'];
const COLUMN_WIDTH = 6000;
const READY_POLL_MS = 1000;
const READY_GIVE_UP_MS = 120_000;

export const LANDINGS_FIXTURE_PLACE = { projectId: PROJECT_ID, canvasId: CANVAS_ID };
export const LANDINGS_FIXTURE_CENTRE = { x: (SITES.length * COLUMN_WIDTH) / 2, y: 4000 };

function emptyCanvas(file) {
  const manifest = { format: 'feega', version: 1, exportedAt: EXPORTED_AT, canvasName: 'landings bench', source: { projectId: PROJECT_ID, canvasId: CANVAS_ID } };
  const canvas = { nodes: [], connections: [], heads: {}, assets: [] };
  writeFileSync(file, zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)), 'canvas.json': strToU8(JSON.stringify(canvas)) }));
}

async function untilReady() {
  const started = Date.now();
  while (Date.now() - started < READY_GIVE_UP_MS) {
    const up = await fetch(`${BASE}/favicon-16.png`).then((r) => r.ok).catch(() => false);
    if (up) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, READY_POLL_MS));
  }
  throw new Error('local server never came up');
}

async function importSite(url, i) {
  const body = { canvasId: CANVAS_ID, url, x: i * COLUMN_WIDTH, y: 0, extent: 'full', sections: true, tokens: true, breakpoints: true };
  const answer = await fetch(`${BASE}/api/v1/projects/${PROJECT_ID}/url-import`, { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: JSON.stringify(body) });
  console.log(`${url} → ${answer.status} ${(await answer.text()).slice(0, 200)}`);
}

async function generate(file) {
  emptyCanvas(file);
  const server = spawn(process.execPath, ['scripts/local.mjs', file, `--port=${PORT}`], { cwd: ROOT, stdio: 'inherit' });
  try {
    await untilReady();
    for (const [i, url] of SITES.entries()) {
      await importSite(url, i);
    }
  } finally {
    server.kill('SIGTERM');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await generate(process.argv[2]);
}
