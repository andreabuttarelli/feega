import type { FaceBook } from '$lib/motion/gpu-full/text/face';
import { Shaping, Spaces, layOut } from '$lib/motion/gpu-full/text/layout';
import { glyphContours, moved } from '$lib/motion/gpu-full/text/painter';
import type { Glyphs } from './chrome';

const LEADING = 1.4;
const TRACKING = -0.2;
const UNBOUNDED = Number.MAX_SAFE_INTEGER;

export function glyphsOf(book: FaceBook, family: string, weight: number): Glyphs {
  return (text, size, set = {}) => {
    const type = { request: { family, weight, italic: false, axes: {} }, size, tracking: TRACKING / size, leading: set.leading ?? LEADING, inset: 0, shaping: Shaping.Runs };
    const laid = layOut(text.split('\n'), type, { spaces: Spaces.Collapse, wraps: set.width !== undefined }, set.width ?? UNBOUNDED, book);
    const lines = laid.blocks.flatMap((b) => b.lines.map((l) => ({ ...l, baseline: l.baseline + b.top })));
    const room = Math.max(set.height ?? UNBOUNDED, laid.lineHeight);
    const fits = lines.filter((_, i) => (i + 1) * laid.lineHeight <= room);
    const contours = fits.flatMap((l) => l.glyphs.flatMap((g) => moved(glyphContours(g.face, g.glyph, size, g.skew, 0), g.x, l.baseline + g.dy)));
    return { contours, width: Math.max(0, ...fits.map((l) => l.width)), height: fits.length * laid.lineHeight };
  };
}
