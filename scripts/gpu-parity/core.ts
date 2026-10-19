import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import sharp from 'sharp';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { parseMotionDoc } from '$lib/motion/doc';
import { drawFrame, prepare } from '$lib/motion/gpu-full/display-list';
import { differing, luma, ssim } from './metrics';

const ROOT = resolve(import.meta.dirname, '../..');
const CORE = join(ROOT, 'packages/gpu-core');
const OUT = resolve(process.env.PARITY_OUT ?? join(homedir(), 'Documents/feega-videos/gpu-motion'));
const PIXEL_TOLERANCE = 8;

const flags = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=') as [string, string]));
const frames = Number(flags.get('frames') ?? 4);
const docs = (flags.get('docs') ?? '').split(',').filter(Boolean);

async function rgba(file: string) {
  const { data, info } = await sharp(file).flatten({ background: '#000' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { pixels: new Uint8Array(data), width: info.width, height: info.height };
}

const rows: string[] = [];
for (const docPath of docs) {
  const verdict = parseMotionDoc(JSON.parse(readFileSync(docPath, 'utf8')));
  if (!verdict.ok) {
    throw new Error(verdict.error);
  }
  const doc = verdict.doc;
  const name = docPath.split('/').pop()!.replace(/\.json$/, '');
  const dir = join(OUT, name, 'core');
  mkdirSync(dir, { recursive: true });
  const prepared = prepare(doc, FEEGA_TOKENS);
  const pairs = Array.from({ length: frames }, (_, i) => {
    const t = Math.floor(((i + 0.5) * doc.durationInFrames) / frames) / doc.fps;
    const list = join(dir, `list-${i}.json`);
    writeFileSync(list, JSON.stringify(drawFrame(prepared, Math.round(t * doc.fps))));
    return [list, join(dir, `core-${String(i).padStart(3, '0')}.png`)];
  });
  execFileSync('cargo', ['run', '--release', '-q', '--bin', 'gpu-core-render', '--', ...pairs.flat()], { cwd: CORE, stdio: ['ignore', 'inherit', 'inherit'] });
  let total = 0;
  let worst = 1;
  let off = 0;
  for (let i = 0; i < frames; i++) {
    const a = await rgba(join(OUT, name, 'frames', `html-${String(i).padStart(3, '0')}.png`));
    const b = await rgba(pairs[i][1]);
    const s = ssim(luma(a.pixels), luma(b.pixels), a.width, a.height);
    total += s;
    worst = Math.min(worst, s);
    off = Math.max(off, differing(a.pixels, b.pixels, PIXEL_TOLERANCE));
  }
  rows.push(`| ${name} | ${(total / frames).toFixed(4)} | ${worst.toFixed(4)} | ${(off * 100).toFixed(2)}% |`);
}
console.log(['| doc | mean SSIM | worst | pixels off (max) |', '|---|---|---|---|', ...rows].join('\n'));
