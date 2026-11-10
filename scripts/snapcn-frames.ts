import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEEGA_TOKENS } from '@feega/motion-core/motion/brand';
import { composeHtml } from '@feega/motion-core/motion/hyperframes/compose';
import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { snapcnPort } from '@feega/motion-core/motion/snapcn/catalog';
import { SNAPCN_CLIP, SNAPCN_PREFIX } from '$lib/motion/template/snapcn';
import { builtinTemplate } from '$lib/motion/template/builtins';
import { chromiumFrames } from '$lib/server/motion/chromium-frames';
import { libsOrigin } from '$lib/server/motion/libs-origin';

const [id, out, ...rest] = process.argv.slice(2);
const port = id ? snapcnPort(id) : null;
const entry = builtinTemplate(`${SNAPCN_PREFIX}${id}`);
if (!port || !entry || !out) {
  console.error('usage: snapcn-frames <id> <out dir> [frame ...] [--props <json>]');
  process.exit(1);
}

const flag = rest.indexOf('--props');
const overrides = flag >= 0 ? (JSON.parse(rest[flag + 1]) as Record<string, unknown>) : {};
const frames = (flag >= 0 ? rest.slice(0, flag) : rest).map(Number);

const withProps = (doc: MotionDoc): MotionDoc => ({
  ...doc,
  tracks: doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === SNAPCN_CLIP ? { ...c, props: { ...c.props, ...overrides } } : c)) }))
});

const doc = withProps(entry.template.doc);
mkdirSync(out, { recursive: true });
const page = await chromiumFrames.open({ width: doc.width, height: doc.height, scale: 1 });
try {
  await page.load(composeHtml({ doc, tokens: FEEGA_TOKENS, assets: {}, origin: libsOrigin() }));
  for (const frame of frames.length ? frames : [0]) {
    await page.seek(frame / doc.fps);
    writeFileSync(join(out, `${id}-${frame}.png`), await page.picture('image/png'));
  }
} finally {
  await page.close();
}
process.exit(0);
