import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { formatOf } from '$lib/motion/doc';
import { BUILTIN_TEMPLATES } from '$lib/motion/template/builtins';
import { PGRID_TEMPLATES } from '$lib/motion/template/parallax-grid/template';
import { setTemplateValues } from '$lib/motion/template/library';
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

const SAMPLES = join(OUT, 'samples');
const SAMPLE_PHOTOS = ['p1015', 'p1016', 'p1018', 'p1039', 'p1043'];
const STRIP_PHOTOS = [...SAMPLE_PHOTOS, 'p1050', 'p1069', 'p1074', 'p1080'];
const SAMPLE_MEDIA: Record<string, { field: string; photos: string[]; values?: Record<string, string>; more?: string[] }> = {
  'builtin:scroll-story': { field: 'image1', photos: ['p1015'], values: { image2: 'p1039', image3: 'p1043' }, more: ['p1039', 'p1043'] },
  'builtin:floating-media': { field: 'media', photos: SAMPLE_PHOTOS },
  'builtin:split-headline': { field: 'media', photos: ['p1043'] },
  'builtin:phone-split': { field: 'media', photos: ['p1039'] },
  'builtin:image-globe': { field: 'media', photos: STRIP_PHOTOS },
  ...Object.fromEntries(PGRID_TEMPLATES.map((e) => [e.id, { field: 'media', photos: STRIP_PHOTOS }])),
  'builtin:photo-strip': { field: 'media', photos: STRIP_PHOTOS, values: { captions: 'fjord, red rock, quiraing, falls, yosemite, coast, jellyfish, lioness, strawberries' } },
  'builtin:circular-carousel': { field: 'media', photos: STRIP_PHOTOS, values: { captions: 'fjord, red rock, quiraing, falls, yosemite, coast, jellyfish, lioness, strawberries' } },
  'builtin:rows-spaced-title': { field: 'media', photos: STRIP_PHOTOS },
  'builtin:scatter-title': { field: 'media', photos: STRIP_PHOTOS },
  'builtin:ring-through-title': { field: 'media', photos: STRIP_PHOTOS },
  'builtin:editorial-words-media': { field: 'media', photos: STRIP_PHOTOS }
};

const sampleAssets = (photos: string[]) => Object.fromEntries(photos.map((id) => [id, `data:image/jpeg;base64,${readFileSync(join(SAMPLES, `${id}.jpg`)).toString('base64')}`]));

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

  const media = SAMPLE_MEDIA[entry.id];
  const filled = media ? setTemplateValues(placed.doc, placed.clipId, { [media.field]: media.photos.join(', '), ...media.values }) : placed;
  if (!filled.ok) {
    console.warn(entry.id, filled.error);
    continue;
  }
  const assets = media ? sampleAssets([...media.photos, ...(media.more ?? [])]) : {};

  const seconds = Math.min(source.durationInFrames / source.fps, MAX_WINDOW_S);
  const times = Array.from({ length: PREVIEW_FRAMES }, (_, i) => (i * seconds) / PREVIEW_FRAMES);
  const frames = await drawFrames(chromiumFrames, { compose: { doc: filled.doc, tokens: FEEGA_TOKENS, assets }, times, size: PREVIEW_SIZE });

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
