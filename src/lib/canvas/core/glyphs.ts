import type { FaceBook } from '@feega/motion-core/motion/gpu-full/text/face';
import { Shaping, Spaces, layOut } from '@feega/motion-core/motion/gpu-full/text/layout';
import { glyphContours, moved } from '@feega/motion-core/motion/gpu-full/text/painter';
import type { Glyphs } from './chrome';

const LEADING = 1.4;
const TRACKING = -0.2;
const CANVAS_TEXT_DROP = 1;
const UNBOUNDED = Number.MAX_SAFE_INTEGER;
const LAID_KEPT = 2000;

export function glyphsOf(book: FaceBook, family: string, weight: number): Glyphs {
  const kept = new Map<string, ReturnType<Glyphs>>();
  return (text, size, set = {}) => {
    const key = JSON.stringify([text, size, set]);
    const hit = kept.get(key);
    if (hit) {
      return hit;
    }
    const laid = lay(text, size, set);
    if (kept.size >= LAID_KEPT) {
      kept.delete(kept.keys().next().value!);
    }
    kept.set(key, laid);
    return laid;
  };

  function lay(text: string, size: number, set: Parameters<Glyphs>[2] = {}) {
    const type = { request: { family, weight, italic: false, axes: {} }, size, tracking: (set.tracking ?? TRACKING) / size, leading: set.leading ?? LEADING, inset: 0, shaping: Shaping.Runs };
    const laid = layOut(text.split('\n'), type, { spaces: Spaces.Collapse, wraps: set.width !== undefined }, set.width ?? UNBOUNDED, book);
    const lines = laid.blocks.flatMap((b) => b.lines.map((l) => ({ ...l, baseline: l.baseline + b.top })));
    const room = Math.max(set.height ?? UNBOUNDED, laid.lineHeight);
    const fits = lines.filter((_, i) => (i + 1) * laid.lineHeight <= room);
    const contours = fits.flatMap((l) => l.glyphs.flatMap((g) => moved(glyphContours(g.face, g.glyph, size, g.skew, 0), g.x, l.baseline + CANVAS_TEXT_DROP + g.dy)));
    return { contours, width: Math.max(0, ...fits.map((l) => l.width)), height: fits.length * laid.lineHeight };
  }
}
