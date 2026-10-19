import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import { parseMotionDoc } from '$lib/motion/doc';
import { drawFrame, prepare } from '$lib/motion/gpu-full/display-list';
import { fontLoader, type Reader } from '$lib/motion/gpu-full/text/load';
import { smoothingOf } from '$lib/motion/gpu-full/text/painter';
import { VIDEO_ASSET, placeholder, placeholderVideo } from './gpu-parity/assets';

const ROOT = resolve(import.meta.dirname, '..');
const CORE = join(ROOT, 'packages/gpu-core');
const REMOTE = /^https?:/;
const BROWSER = { headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36' } };

const flags = new Map(process.argv.slice(2).map((a) => a.replace(/^--/, '').split(/=(.*)/s).slice(0, 2) as [string, string]));

const files: Reader = {
  text: (url) => (REMOTE.test(url) ? fetch(url, BROWSER).then((r) => (r.ok ? r.text() : '')) : Promise.resolve(readFileSync(url, 'utf8'))),
  bytes: (url) => (REMOTE.test(url) ? fetch(url, BROWSER).then((r) => r.arrayBuffer()).then((b) => new Uint8Array(b)) : Promise.resolve(new Uint8Array(readFileSync(url))))
};

function assetIds(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((v) => assetIds(v, into));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'assetId' && typeof v === 'string' && v) {
        into.add(v);
      } else {
        assetIds(v, into);
      }
    }
  }
  return into;
}

async function placeholders(ids: Set<string>, dir: string): Promise<Record<string, string>> {
  mkdirSync(dir, { recursive: true });
  const pairs = await Promise.all(
    [...ids].map(async (id) => {
      const file = join(dir, VIDEO_ASSET.test(id) ? `${id}.mp4` : `${id}.png`);
      writeFileSync(file, VIDEO_ASSET.test(id) ? placeholderVideo() : await placeholder(id));
      return [id, file] as const;
    })
  );
  return Object.fromEntries(pairs);
}

const given = (flag: string | undefined): Record<string, string> => Object.fromEntries((flag ?? '').split(',').filter(Boolean).map((p) => p.split('=') as [string, string]));

const raw = JSON.parse(readFileSync(flags.get('doc') ?? '', 'utf8'));
const verdict = parseMotionDoc(raw.doc ?? raw);
if (!verdict.ok) {
  throw new Error(verdict.error);
}
const doc = verdict.doc;
const assets = { ...(flags.has('placeholders') ? await placeholders(assetIds(doc), flags.get('placeholders')!) : {}), ...given(flags.get('assets')) };
const prepared = prepare(doc, FEEGA_TOKENS, assets, { fonts: await fontLoader(files)(doc, assets, FEEGA_TOKENS), smoothing: smoothingOf(flags.get('user-agent') ?? '') });
const spread = Number(flags.get('spread') ?? 0);
const frames = spread ? Array.from({ length: spread }, (_, i) => Math.round((Math.floor(((i + 0.5) * doc.durationInFrames) / spread) / doc.fps) * doc.fps)) : Array.from({ length: doc.durationInFrames }, (_, i) => i);
const lists = join(mkdtempSync(join(tmpdir(), 'native-export-')), 'frames.jsonl');
writeFileSync(lists, frames.map((f) => JSON.stringify(drawFrame(prepared, f))).join('\n'));
const sink = flags.has('frames') ? ['--frames', resolve(flags.get('frames')!)] : ['--out', resolve(flags.get('out') ?? 'export.mp4')];
execFileSync('cargo', ['run', '--release', '-q', '--bin', 'gpu-core-export', '--', '--lists', lists, '--fps', String(doc.fps), ...sink], { cwd: CORE, stdio: ['ignore', 'inherit', 'inherit'] });
