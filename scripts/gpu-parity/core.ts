import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import sharp from 'sharp';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { parseMotionDoc, type MotionDoc } from '$lib/motion/doc';
import { drawFrame, prepare } from '$lib/motion/gpu-full/display-list';
import { facesLoader, type Reader } from '$lib/motion/gpu-full/text/load';
import { Smoothing } from '$lib/motion/gpu-full/text/painter';
import { differing, luma, ssim } from './metrics';

const ROOT = resolve(import.meta.dirname, '../..');
const CORE = join(ROOT, 'packages/gpu-core');
const BINARY = join(CORE, 'target/release/gpu-core-render');
const OUT = resolve(process.env.PARITY_OUT ?? join(homedir(), 'Documents/feega-videos/gpu-motion'));
const PIXEL_TOLERANCE = 8;
const FONTS = 'fonts';
const BROWSER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const flags = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=') as [string, string]));
const frames = Number(flags.get('frames') ?? 4);
const docs = (flags.get('docs') ?? '').split(',').filter(Boolean);
const smoothing = (flags.get('smoothing') ?? Smoothing.Dilated) as Smoothing;
const prefix = flags.get('prefix') ?? '';

const spread = (doc: MotionDoc, n: number) => Array.from({ length: n }, (_, i) => Math.floor(((i + 0.5) * doc.durationInFrames) / n) / doc.fps);

function savingReader(dir: string, saved: Map<string, string>): Reader {
  return {
    text: (url) => fetch(url, { headers: { 'user-agent': BROWSER_AGENT } }).then((r) => (r.ok ? r.text() : '')),
    bytes: async (url) => {
      const r = await fetch(url);
      if (!r.ok) {
        throw new Error(`${r.status} ${url}`);
      }
      const bytes = new Uint8Array(await r.arrayBuffer());
      const local = join(FONTS, `${saved.size}.font`);
      writeFileSync(join(dir, local), bytes);
      saved.set(url, local);
      return bytes;
    }
  };
}

async function rgba(file: string) {
  const { data, info } = await sharp(file).flatten({ background: '#000' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { pixels: new Uint8Array(data), width: info.width, height: info.height };
}

async function compare(reference: string[], native: string[]) {
  if (!reference.every(existsSync)) {
    return '- | - | -';
  }
  let total = 0;
  let worst = 1;
  let off = 0;
  for (const [i, file] of reference.entries()) {
    const a = await rgba(file);
    const b = await rgba(native[i]);
    const s = ssim(luma(a.pixels), luma(b.pixels), a.width, a.height);
    total += s;
    worst = Math.min(worst, s);
    off = Math.max(off, differing(a.pixels, b.pixels, PIXEL_TOLERANCE));
  }
  return `${(total / reference.length).toFixed(4)} | ${worst.toFixed(4)} | ${(off * 100).toFixed(2)}%`;
}

execFileSync('cargo', ['build', '--release', '-q', '--bin', 'gpu-core-render'], { cwd: CORE, stdio: 'inherit' });

const rows: string[] = [];
for (const docPath of docs) {
  const verdict = parseMotionDoc(JSON.parse(readFileSync(docPath, 'utf8')));
  if (!verdict.ok) {
    throw new Error(verdict.error);
  }
  const doc = verdict.doc;
  const name = prefix + docPath.split('/').pop()!.replace(/\.json$/, '');
  const dir = join(OUT, name, 'native');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, FONTS), { recursive: true });
  const saved = new Map<string, string>();
  const { book, native } = await facesLoader(savingReader(dir, saved))(doc, {});
  const local = { ...native, rules: native.rules.map((r) => ({ ...r, url: saved.get(r.url) ?? r.url })) };
  const prepared = prepare(doc, FEEGA_TOKENS, {}, { fonts: book, smoothing, native: local });
  const lines = spread(doc, frames).map((t) => JSON.stringify(drawFrame(prepared, Math.round(t * doc.fps))));
  writeFileSync(join(dir, 'frames.jsonl'), lines.join('\n'));
  const started = performance.now();
  execFileSync(BINARY, [join(dir, 'frames.jsonl'), `--png=${dir}`], { stdio: ['ignore', 'inherit', 'inherit'] });
  const ms = (performance.now() - started) / frames;
  const pngs = lines.map((_, i) => join(dir, `frame-${String(i).padStart(5, '0')}.png`));
  const shot = (kind: string) => lines.map((_, i) => join(OUT, name, 'frames', `${kind}-${String(i).padStart(3, '0')}.png`));
  rows.push(`| ${name} | ${await compare(shot('gpu'), pngs)} | ${await compare(shot('html'), pngs)} | ${ms.toFixed(0)} |`);
}
console.log(['| doc | vs web export: mean SSIM | worst | pixels off | vs html: mean SSIM | worst | pixels off | native ms/frame |', '|---|---|---|---|---|---|---|---|', ...rows].join('\n'));
