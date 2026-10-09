import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { build } from 'vite';
import { chromium, webkit, type BrowserType } from 'playwright';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { composeHtml } from '$lib/motion/hyperframes/compose';
import { exportSize } from '$lib/motion/export-plan';
import { Resolution } from '$lib/motion/render-quote';
import { CAPTURE_REQUEST, Layering } from '$lib/motion/hyperframes/capture';
import type { MotionDoc } from '$lib/motion/doc';
import { STATS_REPLY, STATS_REQUEST, withProbe, type BenchInput, type BenchResult, type ParityFrame, type ParityInput } from './probe';
import base from '../vite-node.config';

const ENGINES: Record<string, BrowserType> = { chromium, webkit };
const LAUNCH: Record<string, Parameters<BrowserType['launch']>[0]> = {
  chromium: { channel: 'chromium', args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal', '--enable-gpu-rasterization'] },
  webkit: {}
};
const OUT = resolve(process.env.BENCH_OUT ?? join(homedir(), 'Documents/feega-videos/bench'));
const FRAME_TIMEOUT_MS = 3_600_000;

type Args = { doc: string; engines: string[]; lanes: number[]; frames: number; keep: boolean; parity: boolean; live: boolean; strip: Set<string>; layering: Layering };

function args(): Args {
  const flags = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=') as [string, string]));
  return {
    doc: flags.get('doc') ?? '',
    engines: (flags.get('engines') ?? 'chromium,webkit').split(','),
    lanes: (flags.get('lanes') ?? '4,1').split(',').map(Number),
    frames: Number(flags.get('frames') ?? 0),
    keep: flags.has('keep'),
    parity: flags.has('parity'),
    live: flags.has('live'),
    layering: (flags.get('layering') ?? Layering.Split) as Layering,
    strip: new Set((flags.get('strip') ?? '').split(',').filter(Boolean))
  };
}

async function hostBundle(): Promise<string> {
  const out = await build({
    ...base,
    configFile: false,
    logLevel: 'warn',
    build: { write: false, minify: false, lib: { entry: resolve(import.meta.dirname, 'export-host.ts'), formats: ['iife'], name: 'host' } }
  });
  const chunks = (Array.isArray(out) ? out[0] : out) as { output: { code?: string }[] };
  return chunks.output[0].code ?? '';
}

function serve(script: string): Promise<{ url: string; close: () => void }> {
  const page = `<!doctype html><html><body><div id="host" style="position:relative;width:1920px;height:1080px"></div><script src="/host.js"></script></body></html>`;
  const server = createServer((req, res) => (req.url === '/host.js' ? res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' }).end(script) : res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page)));
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${(server.address() as { port: number }).port}/`, close: () => server.close() })));
}

function spread(total: number, count: number, fps: number): number[] {
  const n = count > 0 ? Math.min(count, total) : total;
  return Array.from({ length: n }, (_, i) => Math.floor((i * total) / n) / fps);
}

const ms = (n: number) => n.toFixed(0);

type Tracked = { tracks: { clips: { effects?: { kind: string }[] }[] }[] };

function stripped<T extends Tracked>(doc: T, kinds: Set<string>): T {
  const clean = (d: Tracked) => ({ ...d, tracks: d.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, effects: (c.effects ?? []).filter((e) => !kinds.has(e.kind)) })) })) });
  const comps = (doc as unknown as { comps?: Record<string, Tracked> }).comps ?? {};
  return { ...clean(doc), comps: Object.fromEntries(Object.entries(comps).map(([k, v]) => [k, clean(v)])) } as unknown as T;
}

const { doc: docPath, engines, lanes, frames, keep, parity, live, strip, layering } = args();
const loaded = JSON.parse(readFileSync(docPath, 'utf8')) as { doc: MotionDoc; assets: Record<string, string> };
const doc = stripped(loaded.doc as unknown as Tracked, strip) as unknown as MotionDoc;
const assets = loaded.assets;
const name = docPath.split('/').pop()?.replace('.json', '') ?? 'doc';
const html = withProbe(composeHtml({ doc, tokens: FEEGA_TOKENS, assets }), CAPTURE_REQUEST, STATS_REQUEST, STATS_REPLY);
const size = exportSize(doc, Resolution.P1080);
const times = spread(doc.durationInFrames, frames, doc.fps);
const server = await serve(await hostBundle());
mkdirSync(OUT, { recursive: true });

if (parity) {
  mkdirSync(OUT, { recursive: true });
  for (const engine of engines) {
    const browser = await ENGINES[engine].launch(LAUNCH[engine]);
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.setDefaultTimeout(FRAME_TIMEOUT_MS);
    await page.goto(server.url);
    const run = (i: ParityInput) => page.evaluate((x) => (window as unknown as { parity: (i: ParityInput) => Promise<ParityFrame[]> }).parity(x), i) as Promise<ParityFrame[]>;
    const rows: ParityFrame[] = [];
    for (const group of live ? times.map((t) => [t]) : [times]) {
      rows.push(...(await run({ html, layering, times: group, width: size.width, height: size.height, live })));
      if (live) {
        await page.locator('#host').screenshot({ path: join(OUT, `parity-${name}-${engine}-${group[0].toFixed(2)}-live.png`) });
      }
    }
    for (const r of rows) {
      console.log(`parity ${name} ${engine} t=${r.time.toFixed(2)} mean=${r.mean.toFixed(3)} over8=${(r.over * 100).toFixed(3)}% svgs=${r.svgs}`);
      writeFileSync(join(OUT, `parity-${name}-${engine}-${r.time.toFixed(2)}.png`), Buffer.from(r.png, 'base64'));
      writeFileSync(join(OUT, `parity-${name}-${engine}-${r.time.toFixed(2)}-flat.png`), Buffer.from(r.flat, 'base64'));
    }
    await browser.close();
  }
  server.close();
  process.exit(0);
}

console.log('| doc | engine | lanes | frames | wall ms/frame | seek+settle | serialize | paint | readback | encode | total 465f (s) |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const engine of engines) {
  const browser = await ENGINES[engine].launch(LAUNCH[engine]);
  for (const laneCount of lanes) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.setDefaultTimeout(FRAME_TIMEOUT_MS);
    page.on('pageerror', (e) => console.error(engine, e.message));
    await page.goto(server.url);
    const input: BenchInput = { html, layering, lanes: laneCount, times, width: size.width, height: size.height, fps: doc.fps, keep };
    const r = (await page.evaluate((i) => (window as unknown as { bench: (i: BenchInput) => Promise<BenchResult> }).bench(i), input)) as BenchResult;
    const per = (v: number) => ms(v / r.stages.shots);
    const wall = r.wallMs / r.frames;
    console.log(`| ${name} | ${engine} | ${laneCount} | ${r.frames} | ${ms(wall)} | ${per(r.stages.seek)} | ${per(r.stages.serialize)} | ${per(r.stages.paint)} | ${per(r.stages.readback)} | ${ms(r.encodeMs / r.frames)} | ${((wall * 465) / 1000).toFixed(0)} |`);
    if (r.mp4) {
      writeFileSync(join(OUT, `${name}-${engine}-${laneCount}.mp4`), Buffer.from(r.mp4, 'base64'));
    }
    await page.close();
  }
  await browser.close();
}
server.close();
process.exit(0);
