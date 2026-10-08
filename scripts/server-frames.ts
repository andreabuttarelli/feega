import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { FEEGA_TOKENS } from '$lib/motion/brand';
import type { MotionDoc } from '$lib/motion/doc';
import { drawFrames } from '$lib/server/motion/server-frames';
import { chromiumFrames } from '$lib/server/motion/chromium-frames';

const [docPath = 'src/lib/motion/fixtures/liquid-glass-title.json', at = '0.5,2,4.5'] = process.argv.slice(2);
const OUT = join(homedir(), 'Documents/feega-videos/server-frames');

const doc = JSON.parse(readFileSync(docPath, 'utf8')) as MotionDoc;
const times = at.split(',').map(Number);
mkdirSync(OUT, { recursive: true });

for (const round of ['cold', 'warm']) {
  const t0 = performance.now();
  const frames = await drawFrames(chromiumFrames, { compose: { doc, tokens: FEEGA_TOKENS, assets: {} }, times });
  const ms = Math.round(performance.now() - t0);
  for (const f of frames) {
    writeFileSync(join(OUT, `${round}-${f.time}s.jpg`), f.bytes);
  }
  console.log(round, `${ms}ms`, frames.map((f) => `${f.time}s ${f.bytes.length}B`).join(', '));
}
process.exit(0);
