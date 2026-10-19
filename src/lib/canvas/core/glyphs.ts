import type { FaceBook } from '$lib/motion/gpu-full/text/face';
import { Shaping, Spaces, layOut } from '$lib/motion/gpu-full/text/layout';
import { glyphContours, moved } from '$lib/motion/gpu-full/text/painter';
import type { Glyphs } from './chrome';

const LEADING = 1.4;
const TRACKING = -0.2;
const UNBOUNDED = Number.MAX_SAFE_INTEGER;

export function glyphsOf(book: FaceBook, family: string, weight: number): Glyphs {
  return (text, size, wrap) => {
    const type = { request: { family, weight, italic: false, axes: {} }, size, tracking: TRACKING / size, leading: LEADING, inset: 0, shaping: Shaping.Runs };
    const laid = layOut(text.split('\n'), type, { spaces: Spaces.Collapse, wraps: !!wrap }, wrap?.width ?? UNBOUNDED, book);
    const lines = laid.blocks.flatMap((b) => b.lines.map((l) => ({ ...l, baseline: l.baseline + b.top })));
    const first = lines[0]?.baseline ?? 0;
    const fits = lines.filter((l) => !wrap || l.baseline - first + laid.descent <= wrap.height);
    const contours = fits.flatMap((l) => l.glyphs.flatMap((g) => moved(glyphContours(g.face, g.glyph, size, g.skew, 0), g.x, l.baseline - first + g.dy)));
    return { contours, width: Math.max(0, ...fits.map((l) => l.width)) };
  };
}
