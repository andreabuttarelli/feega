import { apply2d, mul2d, type Affine } from '../affine';
import { runAt } from '../text-runs';
import type { MotionClip } from '../doc';
import { ItemKind, textCaretAt, type DisplayList, type GlyphsItem, type Item, type Prepared } from './display-list';
import { FillRule } from './paint';
import type { CaretLine } from './text/caret';

export type Point = [number, number];

type Polygon = Point[];

const EMPTY: Polygon[] = [];
const GLYPH_ADVANCE_EM = 0.6;
const GLYPH_DESCENT_EM = 0.3;

const rectOf = (left: number, top: number, width: number, height: number): Polygon[] => [[[left, top], [left + width, top], [left + width, top + height], [left, top + height]]];

const moved = (m: Affine, polygons: Polygon[]): Polygon[] => polygons.map((p) => p.map((point) => apply2d(m, point)));

const aboutCentre = (cx: number, cy: number, rotation: number, scale: number): Affine => {
  const c = Math.cos((rotation * Math.PI) / 180) * scale;
  const s = Math.sin((rotation * Math.PI) / 180) * scale;
  return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
};

function glyphBox(item: GlyphsItem): Polygon[] {
  if (!item.glyphs.length) {
    return EMPTY;
  }
  const xs = item.glyphs.map((g) => g[1]);
  const ys = item.glyphs.map((g) => g[2]);
  const left = Math.min(...xs);
  const top = Math.min(...ys) - item.size;
  return rectOf(left, top, Math.max(...xs) + item.size * GLYPH_ADVANCE_EM - left, Math.max(...ys) + item.size * GLYPH_DESCENT_EM - top);
}

const SHAPES: { [K in ItemKind]: (item: Extract<Item, { kind: K }>) => Polygon[] } = {
  [ItemKind.Path]: (item) => item.contours.map((c) => Array.from({ length: c.length / 2 }, (_, i): Point => [c[i * 2], c[i * 2 + 1]])),
  [ItemKind.Image]: (item) => rectOf(0, 0, item.size.width, item.size.height),
  [ItemKind.Layer]: (item) => rectOf(0, 0, item.size.width, item.size.height),
  [ItemKind.Text]: (item) => {
    const { left, top, width, height } = item.plan.frame;
    return moved(aboutCentre(left + width / 2, top + height / 2, item.turn.rotation, item.turn.scale), rectOf(left, top, width, height));
  },
  [ItemKind.Lens]: (item) => rectOf(item.lens.box[0], item.lens.box[1], item.lens.box[2], item.lens.box[3]),
  [ItemKind.Glyphs]: glyphBox,
  [ItemKind.Group]: () => EMPTY
};

const crossings = (polygon: Polygon, [x, y]: Point): number => {
  let winding = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [ax, ay] = polygon[i];
    const [bx, by] = polygon[(i + 1) % polygon.length];
    if (ay <= y === by <= y) {
      continue;
    }
    const left = (bx - ax) * (y - ay) - (x - ax) * (by - ay);
    winding += by > ay ? (left > 0 ? 1 : 0) : left < 0 ? -1 : 0;
  }
  return winding;
};

const INSIDE: Record<FillRule, (windings: number[]) => boolean> = {
  [FillRule.NonZero]: (windings) => windings.reduce((a, b) => a + b, 0) !== 0,
  [FillRule.Union]: (windings) => windings.some((w) => w !== 0),
  [FillRule.EvenOdd]: (windings) => windings.reduce((a, b) => a + Math.abs(b), 0) % 2 === 1
};

const ruleOf = (item: Item): FillRule => (item.kind === ItemKind.Path ? item.rule : FillRule.Union);

function covers(item: Item, point: Point, parent: Affine): boolean {
  const polygons = (SHAPES[item.kind] as (item: Item) => Polygon[])(item);
  const placed = moved(mul2d(parent, item.matrix), polygons);
  return INSIDE[ruleOf(item)](placed.map((polygon) => crossings(polygon, point)));
}

function under(items: readonly Item[], point: Point, parent: Affine): string[] {
  return [...items].reverse().flatMap((item) => {
    if (item.opacity <= 0) {
      return [];
    }
    if (item.kind === ItemKind.Group) {
      return under(item.items, point, mul2d(parent, item.matrix));
    }
    return covers(item, point, parent) ? [item.clip] : [];
  });
}

const IDENTITY_MATRIX: Affine = [1, 0, 0, 1, 0, 0];

export function hitClips(list: DisplayList, point: Point): string[] {
  return [...new Set(under(list.items, point, IDENTITY_MATRIX))];
}

export function hitClip(list: DisplayList, point: Point): string | null {
  return hitClips(list, point)[0] ?? null;
}

function inverse([a, b, c, d, e, f]: Affine): Affine {
  const det = a * d - b * c || Number.EPSILON;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

function charAt(lines: CaretLine[], x: number, y: number): number | null {
  const line = lines.find((l) => y < l.top + l.height) ?? lines.at(-1);
  if (!line || y < line.top) {
    return null;
  }
  const stops = [...line.stops].sort((p, q) => p.offset - q.offset);
  const passed = stops.filter((s) => s.x <= x);
  const last = passed.at(-1);
  const end = stops.at(-1);
  if (!last || !end || x > end.x || last.offset >= line.end) {
    return null;
  }
  return last.offset;
}

const linkOf = (clip: MotionClip, offset: number): string | null => runAt(clip.props.runs as never, offset)?.link ?? null;

const drawnClips = (items: readonly Item[]): string[] => [...items].reverse().flatMap((item) => (item.kind === ItemKind.Group ? drawnClips(item.items) : [item.clip]));

const hasLink = (clip: MotionClip) => ((clip.props.runs as { link?: string }[] | undefined) ?? []).some((run) => run.link);

export function linkAt(prepared: Prepared, frame: number, list: DisplayList, point: Point): string | null {
  const clips = new Map(prepared.doc.tracks.flatMap((t) => t.clips as MotionClip[]).map((c) => [c.id, c]));
  for (const id of new Set(drawnClips(list.items))) {
    const clip = clips.get(id);
    const caret = clip && hasLink(clip) ? textCaretAt(prepared, frame, id) : null;
    if (!clip || !caret) {
      continue;
    }
    const [x, y] = apply2d(inverse(caret.matrix), point);
    const offset = x >= 0 && y >= 0 && x <= caret.width && y <= caret.height ? charAt(caret.lines, x, y) : null;
    const link = offset === null ? null : linkOf(clip, offset);
    if (link) {
      return link;
    }
  }
  return null;
}
