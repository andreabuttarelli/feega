import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { localEnv } from '../local.mjs';
import { LANDINGS_FIXTURE_PLACE, emptyCanvas, untilReady } from './landings-fixture.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const FRAMES = 36;
const COLUMNS = 22;
const GAP_X = 20;
const GAP_Y = 40;
const MIN_HEIGHT = 1500;
const MAX_HEIGHT = 10000;
const IMPORT_TIMEOUT_MS = 240_000;
const SLOT_X = 2000;
const STOP_GRACE_MS = 10_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(() => resolve('timeout'), ms));
const FIT_ZOOM = 0.05;
const FIT_VIEWPORT = { width: 1440, height: 900 };

export const SITES = [
  'https://vercel.com', 'https://stripe.com', 'https://stripe.com/payments', 'https://supabase.com', 'https://www.notion.com', 'https://www.notion.com/product/ai',
  'https://linear.app', 'https://github.com', 'https://www.figma.com', 'https://www.airtable.com', 'https://webflow.com', 'https://www.cloudflare.com',
  'https://www.raycast.com', 'https://deno.com', 'https://railway.com', 'https://www.intercom.com', 'https://www.dropbox.com', 'https://www.mongodb.com',
  'https://sentry.io', 'https://www.netlify.com', 'https://www.twilio.com', 'https://asana.com', 'https://www.atlassian.com', 'https://www.zoom.com',
  'https://arc.net', 'https://www.apple.com', 'https://resend.com', 'https://www.shopify.com', 'https://www.loom.com', 'https://www.framer.com',
  'https://slack.com', 'https://tailwindcss.com', 'https://discord.com',
  'https://vite.dev', 'https://nextjs.org', 'https://astro.build', 'https://bun.sh', 'https://www.docker.com', 'https://about.gitlab.com', 'https://zapier.com', 'https://www.prisma.io', 'https://render.com', 'https://retool.com',
  'https://www.hashicorp.com', 'https://mailchimp.com', 'https://fly.io', 'https://www.digitalocean.com', 'https://svelte.dev', 'https://react.dev', 'https://www.typescriptlang.org', 'https://www.heroku.com', 'https://www.algolia.com', 'https://www.datadoghq.com', 'https://www.elastic.co', 'https://vuejs.org',
  'https://www.postman.com', 'https://www.jetbrains.com', 'https://code.visualstudio.com', 'https://www.npmjs.com', 'https://remix.run', 'https://www.sanity.io', 'https://www.contentful.com', 'https://neon.tech', 'https://turso.tech', 'https://www.convex.dev'
];

const fits = (size) => size.height >= MIN_HEIGHT && size.height <= MAX_HEIGHT;

function earlier(file) {
  const { nodes } = JSON.parse(strFromU8(unzipSync(readFileSync(file))['canvas.json']));
  const entries = nodes.map((n) => ({ slot: Math.round(n.position.x / SLOT_X), node: n }));
  const once = (e) => entries.filter((o) => o.slot === e.slot).length === 1;
  return entries.filter((e) => once(e) && fits(e.node.size)).map((e) => ({ url: SITES[e.slot], id: e.node.id, name: e.node.displayName }));
}

async function importSite(base, url, at) {
  const body = { canvasId: LANDINGS_FIXTURE_PLACE.canvasId, url, x: at, y: 0, extent: 'full', sections: true, tokens: true, breakpoints: true };
  const answer = await fetch(`${base}/api/v1/projects/${LANDINGS_FIXTURE_PLACE.projectId}/url-import`, { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify(body), signal: AbortSignal.timeout(IMPORT_TIMEOUT_MS) }).catch((e) => ({ status: 0, json: async () => ({ error: String(e) }) }));
  const reply = await answer.json().catch(() => ({}));
  const node = reply.nodes?.[0];
  const fit = answer.status === 200 && fits(node.size);
  console.log(`${url} → ${answer.status} ${node ? `${node.size.width}×${node.size.height}` : JSON.stringify(reply).slice(0, 160)}${fit ? '' : ' REJECTED'}`);
  return fit ? { url, id: node.id, name: node.displayName } : null;
}

async function stopped(server) {
  server.kill('SIGTERM');
  const gone = new Promise((resolve) => server.once('exit', resolve));
  if ((await Promise.race([gone, sleep(STOP_GRACE_MS)])) === 'timeout') {
    server.kill('SIGKILL');
  }
}

async function importAll(file, port, tried) {
  const base = `http://127.0.0.1:${port}`;
  const kept = earlier(file);
  writeFileSync(file, pruned(unzipSync(readFileSync(file)), kept));
  const server = spawn(process.execPath, ['scripts/node-server.mjs'], { cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'], env: localEnv(file, String(port)) });
  try {
    await untilReady(base);
    for (const [i, url] of SITES.entries()) {
      if (kept.length >= FRAMES) {
        break;
      }
      if (tried.has(url)) {
        continue;
      }
      tried.add(url);
      const ok = await importSite(base, url, i * SLOT_X);
      if (ok) {
        kept.push(ok);
      }
    }
  } finally {
    await stopped(server);
  }
  if (kept.length < FRAMES) {
    throw new Error(`only ${kept.length} of ${FRAMES} sites imported; add candidates to SITES and run again (it resumes)`);
  }
  return kept.slice(0, FRAMES);
}

function pruned(files, kept, nodesOf = (canvas) => canvas.nodes) {
  const canvas = JSON.parse(strFromU8(files['canvas.json']));
  const ids = new Set(kept.map((k) => k.id));
  const nodes = nodesOf(canvas).filter((n) => ids.has(n.id));
  const heads = Object.fromEntries(nodes.map((n) => [n.id, canvas.heads[n.id]]));
  const used = JSON.stringify([nodes, heads]);
  const assets = canvas.assets.filter((a) => a.mimeType?.startsWith('font/') || used.includes(a.id));
  const out = { 'manifest.json': files['manifest.json'], 'canvas.json': strToU8(JSON.stringify({ ...canvas, nodes, heads, connections: [], events: [], assets })) };
  for (const a of assets.filter((a) => a.file && files[a.file])) {
    out[a.file] = files[a.file];
  }
  return zipSync(out);
}

export function grid(sizes) {
  const order = sizes.map((s, i) => ({ ...s, i })).sort((a, b) => b.height - a.height);
  const rows = [];
  for (let r = 0; r * COLUMNS < order.length; r++) {
    rows.push(order.slice(r * COLUMNS, (r + 1) * COLUMNS));
  }
  const at = new Array(sizes.length);
  let y = 0;
  for (const row of rows) {
    let x = 0;
    for (const cell of row) {
      at[cell.i] = { x, y };
      x += cell.width + GAP_X;
    }
    y += Math.max(...row.map((c) => c.height)) + GAP_Y;
  }
  return at;
}

export function overlaps(boxes) {
  const hit = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  return boxes.flatMap((a, i) => boxes.slice(i + 1).filter((b) => hit(a, b)).map((b) => [a.id, b.id]));
}

function laidOut({ nodes: placed }) {
  const nodes = placed.map((n) => ({ ...n }));
  const at = grid(nodes.map((n) => n.size));
  nodes.forEach((n, i) => {
    n.position = { ...n.position, ...at[i] };
  });

  const boxes = nodes.map((n) => ({ id: n.id, ...n.position, ...n.size }));
  const clash = overlaps(boxes);
  if (clash.length) {
    throw new Error(`overlapping frames: ${JSON.stringify(clash)}`);
  }
  const span = { width: Math.max(...boxes.map((b) => b.x + b.width)), height: Math.max(...boxes.map((b) => b.y + b.height)) };
  const fit = span.width * FIT_ZOOM <= FIT_VIEWPORT.width && span.height * FIT_ZOOM <= FIT_VIEWPORT.height;
  console.log(`grid ${COLUMNS} columns, ${nodes.length} frames, span ${span.width}×${span.height}, at zoom ${FIT_ZOOM}: ${Math.round(span.width * FIT_ZOOM)}×${Math.round(span.height * FIT_ZOOM)} px${fit ? '' : ' DOES NOT FIT'}`);
  return nodes;
}

const posterless = (nodes) => nodes.map(({ data: { posterAssetId: _a, posterRevision: _r, ...data }, ...n }) => ({ ...n, data }));

export function postersFresh(canvas) {
  return canvas.nodes.filter((n) => n.data.posterAssetId && n.data.posterRevision >= n.data.docHeadRevision).length;
}

async function build(dir, port) {
  mkdirSync(dir, { recursive: true });
  const raw = join(dir, 'imported.feega');
  const log = join(dir, 'tried.json');
  if (!existsSync(raw)) {
    emptyCanvas(raw);
  }
  const tried = new Set(existsSync(log) ? JSON.parse(readFileSync(log, 'utf8')) : []);
  try {
    const kept = await importAll(raw, port, tried);
    const files = unzipSync(readFileSync(raw));
    const canvas = JSON.parse(strFromU8(files['canvas.json']));
    const laid = laidOut({ nodes: canvas.nodes.filter((n) => kept.some((k) => k.id === n.id)) });
    writeFileSync(join(dir, 'posters36.feega'), pruned(files, kept, () => laid));
    writeFileSync(join(dir, 'stress36.feega'), pruned(files, kept, () => posterless(laid)));
    writeFileSync(join(dir, 'sites.json'), JSON.stringify(kept, null, 2));
    for (const name of ['posters36', 'stress36']) {
      const { nodes } = JSON.parse(strFromU8(unzipSync(readFileSync(join(dir, `${name}.feega`)))['canvas.json']));
      console.log(`${name}: ${nodes.length} frames, ${postersFresh({ nodes })} with a fresh poster`);
    }
  } finally {
    writeFileSync(log, JSON.stringify([...tried]));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dir, port = '5391'] = process.argv.slice(2);
  if (!dir) {
    console.log('usage: node scripts/perf/stress36-fixture.mjs <out dir> [port]  (needs `npm run build:node` first)');
    process.exit(1);
  }
  await build(dir, port);
}
