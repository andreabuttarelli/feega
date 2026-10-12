import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { formatOf } from '$lib/motion/doc';
import { BUILTIN_TEMPLATES } from '$lib/motion/template/builtins';
import { PREVIEW_DIR, previewSlug, starterDoc, type StarterFormat } from '$lib/motion/template/catalogue';
import { drawFrames } from '$lib/server/motion/server-frames';
import { chromiumFrames } from '$lib/server/motion/chromium-frames';

const OUT = join('static', PREVIEW_DIR);
const MANIFEST = 'src/lib/motion/template/previews.json';
const PREVIEW_SIZE = 480;
const PREVIEW_FPS = 12;
const PREVIEW_FRAMES = 48;
const MAX_WINDOW_S = 8;
const POSTER_AT = 0.6;
const LAYOUT_SAMPLES = join('static', 'compose-templates');
const LAYOUT_PREFIX = 'builtin:composition-';

const only = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const done: string[] = [];

for (const entry of BUILTIN_TEMPLATES.filter((e) => !only.length || only.includes(e.id))) {
  const slug = previewSlug(entry.id);
  const sample = join(LAYOUT_SAMPLES, entry.id.replace(LAYOUT_PREFIX, ''));
  if (entry.id.startsWith(LAYOUT_PREFIX) && existsSync(`${sample}.mp4`)) {
    copyFileSync(`${sample}.jpg`, join(OUT, `${slug}.jpg`));
    copyFileSync(`${sample}.mp4`, join(OUT, `${slug}.mp4`));
    done.push(entry.id);
    continue;
  }

  const source = entry.template.doc;
  let n = 0;
  const placed = starterDoc(entry, formatOf(source) as StarterFormat, () => `p${++n}`);
  if (!placed.ok) {
    console.warn(entry.id, placed.error);
    continue;
  }

  const seconds = Math.min(source.durationInFrames / source.fps, MAX_WINDOW_S);
  const times = Array.from({ length: PREVIEW_FRAMES }, (_, i) => (i * seconds) / PREVIEW_FRAMES);
  const frames = await drawFrames(chromiumFrames, { compose: { doc: placed.doc, tokens: FEEGA_TOKENS, assets: {} }, times, size: PREVIEW_SIZE });

  const work = mkdtempSync(join(tmpdir(), 'preview-'));
  frames.forEach((f, i) => writeFileSync(join(work, `${String(i).padStart(3, '0')}.jpg`), f.bytes));
  writeFileSync(join(OUT, `${slug}.jpg`), frames[Math.floor(frames.length * POSTER_AT)].bytes);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(PREVIEW_FPS), '-i', join(work, '%03d.jpg'), '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '30', '-movflags', '+faststart', '-an', join(OUT, `${slug}.mp4`)]);
  rmSync(work, { recursive: true });
  done.push(entry.id);
  console.log(entry.id);
}

const kept = only.length ? [...new Set([...(await import('$lib/motion/template/previews.json')).default, ...done])] : done;
writeFileSync(MANIFEST, `${JSON.stringify(kept.sort(), null, 2)}\n`);
process.exit(0);
