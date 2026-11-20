import { Background, MotionFormat, findClip, newMotionDoc, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { FillType } from '@feega/motion-core/motion/fill/model';
import { Direction } from '@feega/motion-core/motion/layout/auto-layout';
import { setStill } from '@feega/motion-core/motion/still';
import { TextSizing } from '@feega/motion-core/motion/text-sizing';
import { setProps, type OpResult } from '@feega/motion-core/motion/timeline';
import { drawClip } from '$lib/motion/draw-create';
import { DrawTool } from '$lib/motion/draw-tool';
import { setAutoLayout } from '$lib/motion/layout/ops';
import { radiusShown, radiusStored } from '$lib/motion/radius-px';
import { LiveProp, Side, activeIndex, familyRule, utilityOf, type LiveEditBody, type LivePick, type LivePreview, type LiveRect } from '@feega/live-edit/live-fields';
import { DIRECT_ROWS, cssClassOf, cssOf, cssRows, directMake, type ClassCtx, type ClassRow } from './live-class-rows';

export const LIVE_CLIP = 'live';

const MIN_SIDE_PX = 2;
const CENTRE = 0.5;
const REGULAR_WEIGHT = 400;
const TRANSPARENT_ALPHA = 0;
const RGB = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/;
const STACKING = new Set(['flex', 'inline-flex', 'grid', 'inline-grid']);
const ROW = new Set(['row', 'row-reverse']);

type Paint = { type?: string; color?: string };
type Space = { side: number; box: { width: number; height: number } };
type Row = { prop: LiveProp; side?: Side; css: string; read: (clip: MotionClip, space: Space) => string | undefined };

const px = (raw: string | undefined) => parseFloat(raw ?? '') || 0;
const pixels = (n: number | undefined) => (n === undefined ? undefined : `${Math.round(n)}px`);
const isText = (clip: MotionClip) => clip.component === 'Text';
const solidOf = (clip: MotionClip) => (clip.props.fills as Paint[] | undefined)?.find((f) => f.type === FillType.Solid)?.color;
const textProp = (clip: MotionClip, key: string) => (isText(clip) && clip.props[key] !== undefined ? String(clip.props[key]) : undefined);

function hexOf(raw: string | undefined): string | null {
  const m = raw?.match(RGB);
  if (!m || (m[4] !== undefined && parseFloat(m[4]) === TRANSPARENT_ALPHA)) {
    return null;
  }
  return `#${m.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
}

const padding = (side: Side, edge: 'top' | 'right' | 'bottom' | 'left'): Row => ({ prop: LiveProp.Padding, side, css: `padding-${edge}`, read: (c) => pixels(c.autoLayout?.padding[edge]) });

const ROWS: Row[] = [
  { prop: LiveProp.Text, css: '', read: (c) => textProp(c, 'text') },
  { prop: LiveProp.Color, css: 'color', read: (c) => textProp(c, 'color') },
  { prop: LiveProp.Fill, css: 'background-color', read: (c) => (isText(c) ? undefined : solidOf(c)) },
  { prop: LiveProp.FontSize, css: 'font-size', read: (c, s) => (isText(c) && typeof c.props.size === 'number' ? pixels(c.props.size * s.side) : undefined) },
  { prop: LiveProp.FontWeight, css: 'font-weight', read: (c) => textProp(c, 'weight') },
  { prop: LiveProp.Gap, css: 'gap', read: (c) => pixels(c.autoLayout?.gap) },
  padding(Side.Top, 'top'),
  padding(Side.Right, 'right'),
  padding(Side.Bottom, 'bottom'),
  padding(Side.Left, 'left'),
  { prop: LiveProp.Radius, css: 'border-radius', read: (c, s) => (isText(c) ? undefined : pixels(radiusShown(Number(c.props.roundness ?? 0), s.box))) }
];

const sideOf = (rect: LiveRect) => Math.max(MIN_SIDE_PX, Math.ceil(Math.max(rect.width, rect.height)));

const spaceOf = (doc: MotionDoc, clip: MotionClip): Space => ({ side: doc.width, box: { width: Number(clip.props.width ?? 0) * doc.width, height: Number(clip.props.height ?? 0) * doc.height } });

function blank(rect: LiveRect): MotionDoc {
  const side = sideOf(rect);
  const sized = { ...newMotionDoc(MotionFormat.Landscape), width: side, height: side, background: Background.Transparent };
  const still = setStill(sized, 0);
  return still.ok ? still.doc : sized;
}

const through = (result: OpResult, next: (doc: MotionDoc) => OpResult): OpResult => (result.ok ? next(result.doc) : result);

function textElement(doc: MotionDoc, pick: LivePick, box: { x: number; y: number; width: number; height: number }): OpResult {
  const look = { text: pick.text ?? '', color: hexOf(pick.styles.color) ?? '#000000', weight: px(pick.styles['font-weight']) || REGULAR_WEIGHT };
  const drawn = drawClip(doc, DrawTool.Text, box, 0, LIVE_CLIP, TextSizing.Fixed, look);
  return through(drawn, (made) => setProps(made, LIVE_CLIP, { size: px(pick.styles['font-size']) / doc.width }));
}

function boxElement(doc: MotionDoc, pick: LivePick, box: { x: number; y: number; width: number; height: number }): OpResult {
  const { styles, rect } = pick;
  const fill = hexOf(styles['background-color']);
  const stacks = STACKING.has(styles.display);
  const drawn = drawClip(doc, stacks ? DrawTool.Stack : DrawTool.Frame, box, 0, LIVE_CLIP);
  const painted = through(drawn, (made) => setProps(made, LIVE_CLIP, { fills: fill ? [{ type: FillType.Solid, color: fill }] : [], roundness: radiusStored(px(styles['border-radius']), rect) }));
  if (!stacks) {
    return painted;
  }
  const layout = {
    direction: ROW.has(styles['flex-direction']) ? Direction.Horizontal : Direction.Vertical,
    gap: px(styles.gap),
    padding: { top: px(styles['padding-top']), right: px(styles['padding-right']), bottom: px(styles['padding-bottom']), left: px(styles['padding-left']) }
  };
  return through(painted, (made) => setAutoLayout(made, LIVE_CLIP, layout));
}

export function liveDocOf(pick: LivePick): MotionDoc {
  const doc = blank(pick.rect);
  const box = { x: CENTRE, y: CENTRE, width: Math.max(pick.rect.width, 1) / doc.width, height: Math.max(pick.rect.height, 1) / doc.height };
  const made = pick.text === null ? boxElement(doc, pick, box) : textElement(doc, pick, box);
  return made.ok ? made.doc : doc;
}

type Change = { row: Row; value: string; was: string };

function changesOf(before: MotionDoc, after: MotionDoc): Change[] {
  const was = findClip(before, LIVE_CLIP)?.clip;
  const now = findClip(after, LIVE_CLIP)?.clip;
  if (!was || !now) {
    return [];
  }
  return ROWS.flatMap((row) => {
    const value = row.read(now, spaceOf(after, now));
    const old = row.read(was, spaceOf(before, was));
    return value === undefined || value === old ? [] : [{ row, value, was: old ?? '' }];
  });
}

const PAIRS: { side: Side; of: Side[] }[] = [
  { side: Side.All, of: [Side.Top, Side.Right, Side.Bottom, Side.Left] },
  { side: Side.Y, of: [Side.Top, Side.Bottom] },
  { side: Side.X, of: [Side.Left, Side.Right] }
];

function merged(changes: Change[]): Change[] {
  for (const pair of PAIRS) {
    const sides = changes.filter((c) => c.row.prop === LiveProp.Padding && pair.of.includes(c.row.side!));
    if (sides.length === pair.of.length && sides.every((c) => c.value === sides[0].value)) {
      const one = { ...sides[0], row: { ...sides[0].row, side: pair.side } };
      return merged([...changes.filter((c) => !sides.includes(c)), one]);
    }
  }
  return changes;
}

type ClassChange = { row: ClassRow; value: string | undefined; was: string | undefined; atOrigin: boolean };

function ctxOf(doc: MotionDoc, origin: MotionClip): ClassCtx | null {
  const clip = findClip(doc, LIVE_CLIP)?.clip;
  return clip ? { clip, doc, origin, css: cssOf(doc, LIVE_CLIP) } : null;
}

const byFamily = (rows: ClassRow[]) => [...new Map(rows.map((r) => [r.family, r])).values()];

function classChangesOf(before: MotionDoc, after: MotionDoc, origin: MotionDoc): ClassChange[] {
  const first = findClip(origin, LIVE_CLIP)?.clip;
  const was = first ? ctxOf(before, first) : null;
  const now = first ? ctxOf(after, first) : null;
  const start = first ? ctxOf(origin, first) : null;
  if (!was || !now || !start) {
    return [];
  }
  const rows = byFamily([...cssRows(was.css), ...cssRows(now.css), ...DIRECT_ROWS]);
  return rows.flatMap((row) => {
    const value = row.read(now);
    const old = row.read(was);
    return value === old ? [] : [{ row, value, was: old, atOrigin: value === row.read(start) }];
  });
}

function originalToken(pick: LivePick, family: string): string {
  const owns = familyRule(family)?.owns;
  const parts = pick.classes.split(/\s+/);
  const at = owns ? activeIndex(parts, (utility) => owns(utility, Side.All), pick.viewport ?? 0) : -1;
  return at < 0 ? '' : utilityOf(parts[at]);
}

function classTokenOf(change: ClassChange, pick: LivePick): string {
  if (change.atOrigin || change.value === undefined) {
    return change.atOrigin ? originalToken(pick, change.row.family) : '';
  }
  return (directMake(change.row) ?? ((v: string) => cssClassOf(change.row, v)))(change.value);
}

const extras = (pick: LivePick) => ({ ...(pick.rem ? { rem: pick.rem } : {}), ...(pick.viewport ? { viewport: pick.viewport } : {}) });

export function liveEditsOf(before: MotionDoc, after: MotionDoc, pick: LivePick): LiveEditBody[] {
  const style = merged(changesOf(before, after)).map(({ row, value, was }) => ({ at: pick.source, prop: row.prop, ...(row.side ? { side: row.side } : {}), value, was, ...extras(pick) }));
  const classes = classChangesOf(before, after, liveDocOf(pick)).map((change) => ({ at: pick.source, prop: LiveProp.Class, family: change.row.family, value: classTokenOf(change, pick), was: change.was ?? '', ...extras(pick) }));
  return [...style, ...classes];
}

export function unwrittenOf(before: MotionDoc, after: MotionDoc): boolean {
  const was = findClip(before, LIVE_CLIP)?.clip;
  const now = findClip(after, LIVE_CLIP)?.clip;
  if (!was || !now || JSON.stringify(was) === JSON.stringify(now)) {
    return false;
  }
  return !changesOf(before, after).length && !classChangesOf(before, after, before).length;
}

export function livePreviewOf(before: MotionDoc, after: MotionDoc): LivePreview {
  const changes = changesOf(before, after);
  const text = changes.find((c) => c.row.prop === LiveProp.Text)?.value;
  const classed = classChangesOf(before, after, before);
  const now = findClip(before, LIVE_CLIP)?.clip;
  const ctx = now ? ctxOf(after, now) : null;
  const style = {
    ...Object.fromEntries(changes.filter((c) => c.row.css).map((c) => [c.row.css, c.value])),
    ...Object.assign({}, ...classed.map((c) => (ctx ? c.row.preview(c.value, ctx) : {})))
  };
  return { ...(text === undefined ? {} : { text }), ...(Object.keys(style).length ? { style } : {}) };
}
