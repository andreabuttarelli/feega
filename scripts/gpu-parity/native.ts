import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { luma, ssim } from './metrics';

const ROOT = resolve(import.meta.dirname, '../..');
const OUT = resolve(process.env.PARITY_OUT ?? join(homedir(), 'Documents/feega-videos/gpu-motion'));

const flags = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=') as [string, string]));
const reference = flags.get('ref') ?? '';
const docs = (flags.get('docs') ?? '').split(',').filter(Boolean);

async function rgba(file: string) {
  const { data, info } = await sharp(file).flatten({ background: '#000' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { pixels: new Uint8Array(data), width: info.width, height: info.height };
}

const rows: string[] = [];
for (const docPath of docs) {
  const name = docPath.split('/').pop()!.replace(/\.json$/, '');
  const refDir = join(OUT, reference.replace('{kind}', name.replace(/^kind-/, '')), 'frames');
  const html = readdirSync(refDir).filter((f) => f.startsWith('html-')).sort();
  const dir = join(OUT, `native-${name}`);
  execFileSync('npx', ['vite-node', '--config', 'scripts/vite-node.config.ts', 'scripts/native-export.ts', `--doc=${docPath}`, `--placeholders=${join(dir, 'assets')}`, `--spread=${html.length}`, `--frames=${join(dir, 'frames')}`, '--user-agent=Macintosh'], { cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit'] });
  const native = readdirSync(join(dir, 'frames')).filter((f) => f.startsWith('frame-')).sort();
  let total = 0;
  let worst = 1;
  for (const [i, file] of html.entries()) {
    const a = await rgba(join(refDir, file));
    const b = await rgba(join(dir, 'frames', native[i]));
    const s = ssim(luma(a.pixels), luma(b.pixels), a.width, a.height);
    total += s;
    worst = Math.min(worst, s);
  }
  rows.push(`| ${name} | ${(total / html.length).toFixed(4)} | ${worst.toFixed(4)} |`);
}
console.log(['| doc | mean SSIM | worst |', '|---|---|---|', ...rows].join('\n'));
