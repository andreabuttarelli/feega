import { z } from 'zod';
import { Direction, Sizing } from '../layout/auto-layout';
import { DEFAULT_AUTO_LAYOUT, DEFAULT_LAYOUT_ITEM, MAX_GRID_COLUMNS, MAX_GRID_ROWS, MAX_LAYOUT_PX, paddingSchema, SIZINGS } from '../layout/model';
import { HORIZONTALS, VERTICALS } from '../constraints/model';
import type { MotionClip, MotionDoc } from '../doc';
import { restretched } from '../layout/resolve';
import { TEXT_SIZINGS, TEXT_WRAPS } from '../text-sizing';
import { AXES, LETTER_SPACING, LINE_HEIGHT } from '../type-units';
import { pathString } from '../shape/schema';

export const BASE_BREAKPOINT = 'base';
export const MAX_BREAKPOINTS = 8;
const MIN_BREAKPOINT_WIDTH = 120;

export enum OverrideKey {
  Direction = 'autoLayout.direction',
  Wrap = 'autoLayout.wrap',
  Gap = 'autoLayout.gap',
  Padding = 'autoLayout.padding',
  Columns = 'autoLayout.columns',
  Width = 'layoutItem.width',
  Height = 'layoutItem.height',
  ColumnSpan = 'layoutItem.columnSpan',
  Absolute = 'layoutItem.absolute',
  Hidden = 'hidden',
  FontSize = 'props.size',
  TextAlign = 'props.align',
  TextSizing = 'props.sizing',
  LineHeight = 'props.lineHeight',
  TextWrap = 'props.textWrap',
  LetterSpacing = 'props.letterSpacing',
  FontAxes = 'props.axes',
  Outline = 'props.path',
  X = 'props.x',
  Y = 'props.y',
  BoxWidth = 'props.width',
  BoxHeight = 'props.height',
  PinHorizontal = 'constraints.horizontal',
  PinVertical = 'constraints.vertical'
}

const signedPx = z.number().min(-MAX_LAYOUT_PX).max(MAX_LAYOUT_PX);
const fraction = z.number().min(-10).max(10);

type Section = 'autoLayout' | 'layoutItem' | 'constraints' | 'props' | null;

const OVERRIDES: Record<OverrideKey, { section: Section; field: string; value: z.ZodType; label: string }> = {
  [OverrideKey.Direction]: { section: 'autoLayout', field: 'direction', value: z.enum(Object.values(Direction) as [Direction, ...Direction[]]), label: 'Direction' },
  [OverrideKey.Wrap]: { section: 'autoLayout', field: 'wrap', value: z.boolean(), label: 'Wrap' },
  [OverrideKey.Gap]: { section: 'autoLayout', field: 'gap', value: signedPx, label: 'Gap' },
  [OverrideKey.Padding]: { section: 'autoLayout', field: 'padding', value: paddingSchema, label: 'Padding' },
  [OverrideKey.Columns]: { section: 'autoLayout', field: 'columns', value: z.number().int().min(1).max(MAX_GRID_COLUMNS), label: 'Columns' },
  [OverrideKey.Width]: { section: 'layoutItem', field: 'width', value: z.enum(SIZINGS), label: 'Width sizing' },
  [OverrideKey.Height]: { section: 'layoutItem', field: 'height', value: z.enum(SIZINGS), label: 'Height sizing' },
  [OverrideKey.ColumnSpan]: { section: 'layoutItem', field: 'columnSpan', value: z.number().int().min(1).max(MAX_GRID_ROWS), label: 'Column span' },
  [OverrideKey.Absolute]: { section: 'layoutItem', field: 'absolute', value: z.boolean(), label: 'Ignore auto layout' },
  [OverrideKey.Hidden]: { section: null, field: 'hidden', value: z.boolean(), label: 'Visibility' },
  [OverrideKey.FontSize]: { section: 'props', field: 'size', value: z.number().positive().max(10), label: 'Font size' },
  [OverrideKey.TextAlign]: { section: 'props', field: 'align', value: z.enum(['left', 'center', 'right']), label: 'Text align' },
  [OverrideKey.TextSizing]: { section: 'props', field: 'sizing', value: z.enum(TEXT_SIZINGS), label: 'Text resizing' },
  [OverrideKey.LineHeight]: { section: 'props', field: 'lineHeight', value: z.string().regex(LINE_HEIGHT), label: 'Line height' },
  [OverrideKey.TextWrap]: { section: 'props', field: 'textWrap', value: z.enum(TEXT_WRAPS), label: 'Text wrap' },
  [OverrideKey.LetterSpacing]: { section: 'props', field: 'letterSpacing', value: z.string().regex(LETTER_SPACING), label: 'Letter spacing' },
  [OverrideKey.FontAxes]: { section: 'props', field: 'axes', value: z.string().regex(AXES), label: 'Font axes' },
  [OverrideKey.Outline]: { section: 'props', field: 'path', value: pathString, label: 'Outline' },
  [OverrideKey.X]: { section: 'props', field: 'x', value: fraction, label: 'X' },
  [OverrideKey.Y]: { section: 'props', field: 'y', value: fraction, label: 'Y' },
  [OverrideKey.BoxWidth]: { section: 'props', field: 'width', value: fraction, label: 'Width' },
  [OverrideKey.BoxHeight]: { section: 'props', field: 'height', value: fraction, label: 'Height' },
  [OverrideKey.PinHorizontal]: { section: 'constraints', field: 'horizontal', value: z.enum(HORIZONTALS), label: 'Horizontal constraint' },
  [OverrideKey.PinVertical]: { section: 'constraints', field: 'vertical', value: z.enum(VERTICALS), label: 'Vertical constraint' }
};

export const OVERRIDE_KEYS = Object.values(OverrideKey);
export const overrideLabel = (key: OverrideKey) => OVERRIDES[key].label;

export const breakpointSchema = z.object({ id: z.string().min(1).max(40), name: z.string().min(1).max(40), width: z.number().int().min(MIN_BREAKPOINT_WIDTH).max(MAX_LAYOUT_PX), height: z.number().int().positive().optional() });
export const breakpointsSchema = z.array(breakpointSchema).max(MAX_BREAKPOINTS).optional();
export const overridesSchema = z.record(z.string().min(1), z.partialRecord(z.enum(OVERRIDE_KEYS as [OverrideKey, ...OverrideKey[]]), z.unknown())).optional();

export type Breakpoint = z.infer<typeof breakpointSchema>;
export type ClipOverrides = Partial<Record<OverrideKey, unknown>>;

export enum BreakpointPreset {
  Tablet = 'tablet',
  Phone = 'phone'
}

const PRESETS: Record<BreakpointPreset, Omit<Breakpoint, 'id'>> = {
  [BreakpointPreset.Tablet]: { name: 'Tablet', width: 810 },
  [BreakpointPreset.Phone]: { name: 'Phone', width: 390 }
};

export const BASE_NAME = 'Desktop';

type Result = { ok: true; doc: MotionDoc } | { ok: false; error: string };

type Tracks = MotionDoc['tracks'];

const clipsIn = (tracks: Tracks) => tracks.flatMap((t) => t.clips) as MotionClip[];

const clipsOf = (doc: MotionDoc) => clipsIn(doc.tracks);

const mappedTracks = (tracks: Tracks, fn: (clip: MotionClip) => MotionClip): Tracks => tracks.map((t) => ({ ...t, clips: t.clips.map((c) => fn(c as MotionClip)) })) as Tracks;

const mapTop = (doc: MotionDoc, fn: (clip: MotionClip) => MotionClip): MotionDoc => ({ ...doc, tracks: mappedTracks(doc.tracks, fn) });

const mapClips = (doc: MotionDoc, fn: (clip: MotionClip) => MotionClip): MotionDoc => ({
  ...mapTop(doc, fn),
  ...(doc.comps ? { comps: Object.fromEntries(Object.entries(doc.comps).map(([id, comp]) => [id, { ...comp, tracks: mappedTracks(comp.tracks, fn) }])) as MotionDoc['comps'] } : {})
});

export function viewsOf(doc: MotionDoc): Breakpoint[] {
  const base = { id: BASE_BREAKPOINT, name: BASE_NAME, width: doc.width };
  return [base, ...[...(doc.breakpoints ?? [])].sort((a, b) => b.width - a.width)];
}

export function addBreakpoint(doc: MotionDoc, spec: BreakpointPreset | Omit<Breakpoint, 'id'>, id: string): Result {
  const bp = { id, ...(typeof spec === 'string' ? PRESETS[spec] : spec) };
  const views = viewsOf(doc);

  if (bp.width >= doc.width) {
    return { ok: false, error: `a breakpoint is narrower than the frame (${doc.width}px)` };
  }
  if (views.some((v) => v.width === bp.width || v.id === bp.id)) {
    return { ok: false, error: `a breakpoint at ${bp.width}px already exists` };
  }
  if (views.length > MAX_BREAKPOINTS) {
    return { ok: false, error: `at most ${MAX_BREAKPOINTS} breakpoints` };
  }
  const parsed = breakpointSchema.safeParse(bp);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  return { ok: true, doc: { ...doc, breakpoints: [...(doc.breakpoints ?? []), parsed.data] } };
}

const withoutKey = <T extends Record<string, unknown>>(record: T | undefined, key: string): T | undefined => {
  if (!record) {
    return undefined;
  }
  const rest = Object.fromEntries(Object.entries(record).filter(([k]) => k !== key)) as T;
  return Object.keys(rest).length ? rest : undefined;
};

const withOverrides = (clip: MotionClip, overrides: MotionClip['overrides']): MotionClip => {
  const { overrides: _old, ...rest } = clip;
  return (overrides ? { ...rest, overrides } : rest) as MotionClip;
};

export function removeBreakpoint(doc: MotionDoc, id: string): MotionDoc {
  const left = (doc.breakpoints ?? []).filter((b) => b.id !== id);
  const { breakpoints: _old, ...rest } = mapClips(doc, (c) => withOverrides(c, withoutKey(c.overrides, id)));
  return (left.length ? { ...rest, breakpoints: left } : rest) as MotionDoc;
}

const tracksAt = (doc: MotionDoc, comp: string | null): Tracks | null => (comp ? (doc.comps?.[comp]?.tracks ?? null) : doc.tracks);

const withTracksAt = (doc: MotionDoc, comp: string | null, tracks: Tracks): MotionDoc => (comp ? { ...doc, comps: { ...doc.comps, [comp]: { ...doc.comps[comp], tracks } } } : { ...doc, tracks });

export function setOverride(doc: MotionDoc, breakpointId: string, clipId: string, key: OverrideKey, value: unknown, comp: string | null = null): Result {
  const spec = OVERRIDES[key];
  if (!spec) {
    return { ok: false, error: `${key} cannot vary per breakpoint; it takes one of ${OVERRIDE_KEYS.join(', ')}` };
  }
  if (!(doc.breakpoints ?? []).some((b) => b.id === breakpointId)) {
    return { ok: false, error: `no breakpoint ${breakpointId}: the base frame is edited directly` };
  }
  const tracks = tracksAt(doc, comp);
  if (!tracks || !clipsIn(tracks).some((c) => c.id === clipId)) {
    return { ok: false, error: `no clip ${clipId}` };
  }
  const parsed = spec.value.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: `${key}: ${parsed.error.issues[0].message}` };
  }

  return { ok: true, doc: withTracksAt(doc, comp, mappedTracks(tracks, (c) => (c.id === clipId ? withOverrides(c, { ...c.overrides, [breakpointId]: { ...c.overrides?.[breakpointId], [key]: parsed.data } }) : c))) };
}

export function clearOverride(doc: MotionDoc, breakpointId: string, clipId: string, key: OverrideKey): MotionDoc {
  return mapTop(doc, (c) => {
    if (c.id !== clipId) {
      return c;
    }
    const at = withoutKey(c.overrides?.[breakpointId], key);
    return withOverrides(c, at ? { ...c.overrides, [breakpointId]: at } : withoutKey(c.overrides, breakpointId));
  });
}

export function overriddenIn(doc: MotionDoc, clipId: string, key: OverrideKey): string[] {
  const clip = clipsOf(doc).find((c) => c.id === clipId);
  return viewsOf(doc)
    .filter((v) => clip?.overrides?.[v.id] && key in clip.overrides[v.id])
    .map((v) => v.id);
}

export function stackOn(doc: MotionDoc, breakpointId: string, containerId: string): Result {
  const stacked = setOverride(doc, breakpointId, containerId, OverrideKey.Direction, Direction.Vertical);
  const children = clipsOf(doc).filter((c) => c.parent === containerId);
  return children.reduce<Result>((r, child) => (r.ok ? setOverride(r.doc, breakpointId, child.id, OverrideKey.Width, Sizing.Fill) : r), stacked);
}

const SECTION_DEFAULTS: Record<Exclude<Section, null>, Record<string, unknown>> = {
  autoLayout: DEFAULT_AUTO_LAYOUT,
  layoutItem: DEFAULT_LAYOUT_ITEM,
  constraints: {},
  props: {}
};

function applyOverride(clip: MotionClip, key: OverrideKey, value: unknown): MotionClip {
  const { section, field } = OVERRIDES[key];
  if (!section) {
    return { ...clip, [field]: value };
  }
  if (section === 'autoLayout' && !clip.autoLayout) {
    return clip;
  }
  const current = (clip[section] as Record<string, unknown> | undefined) ?? SECTION_DEFAULTS[section];
  return { ...clip, [section]: { ...current, [field]: value } };
}

function readField(clip: MotionClip, key: OverrideKey): unknown {
  const { section, field } = OVERRIDES[key];
  const holder = (section ? clip[section] : clip) as Record<string, unknown> | undefined;
  return holder?.[field];
}

const PRECISION = 1e9;
const rounded = (_key: string, v: unknown) => (typeof v === 'number' ? Math.round(v * PRECISION) / PRECISION : v);
const same = (a: unknown, b: unknown) => JSON.stringify(a, rounded) === JSON.stringify(b, rounded);

const unitOf = (size: { width: number; height: number }) => Math.min(size.width, size.height);

type Stroke = { width?: number; sides?: number[] };

enum Anchor {
  Frame = 'frame',
  Pixels = 'pixels'
}

function rescaleClip(clip: MotionClip, unit: number, across: number, anchor: Anchor = Anchor.Frame): MotionClip {
  const props = { ...clip.props };
  if (typeof props.size === 'number') {
    props.size = props.size * unit;
  }
  if (Array.isArray(props.strokes)) {
    props.strokes = (props.strokes as Stroke[]).map((s) => ({ ...s, ...(typeof s.width === 'number' ? { width: s.width * unit } : {}), ...(s.sides ? { sides: s.sides.map((w) => w * unit) } : {}) }));
  }
  if ((clip.parent || anchor === Anchor.Pixels) && typeof props.width === 'number') {
    props.width = props.width * across;
  }
  if (anchor === Anchor.Pixels && typeof props.x === 'number') {
    props.x = props.x * across;
  }
  return { ...clip, props };
}

export function heldPixels(doc: MotionDoc, from: { width: number; height: number }): MotionDoc {
  const unit = unitOf(from) / unitOf(doc);
  const across = from.width / doc.width;
  const comps = Object.fromEntries(
    Object.entries(doc.comps ?? {}).map(([id, comp]) => [id, comp.frame ? comp : { ...comp, tracks: comp.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => rescaleClip(c as MotionClip, unit, across, Anchor.Pixels)) })) }])
  ) as MotionDoc['comps'];
  return { ...mapTop(doc, (c) => rescaleClip(c, unit, across)), comps };
}

const rescale = (doc: MotionDoc, width: number): MotionDoc => heldPixels({ ...doc, width }, doc);

function cascaded(doc: MotionDoc, breakpointId: string): { doc: MotionDoc; width: number; height: number } {
  const views = viewsOf(doc);
  const target = views.find((v) => v.id === breakpointId) ?? views[0];
  const cascade = views.filter((v) => v.width >= target.width).map((v) => v.id);

  const applied = mapClips(doc, (clip) => cascade.reduce((c, id) => Object.entries(clip.overrides?.[id] ?? {}).reduce((acc, [key, value]) => applyOverride(acc, key as OverrideKey, value), c), clip));
  return { doc: applied, width: target.width, height: target.height ?? doc.height };
}

const changedKeys = (after: MotionClip, before: MotionClip) => OVERRIDE_KEYS.filter((key) => !same(readField(after, key), readField(before, key)));

function liftClip(edited: MotionClip, source: MotionClip, before: MotionClip, breakpointId: string): MotionClip {
  const changed = changedKeys(edited, before);
  if (!changed.length) {
    return source;
  }

  const at = { ...source.overrides?.[breakpointId], ...Object.fromEntries(changed.map((key) => [key, readField(edited, key)])) };
  return withOverrides(source, { ...source.overrides, [breakpointId]: at });
}

export function carryChanges(into: MotionDoc, before: MotionDoc, after: MotionDoc): MotionDoc {
  const befores = new Map(clipsOf(before).map((c) => [c.id, c]));
  const afters = new Map(clipsOf(after).map((c) => [c.id, c]));
  return mapTop(into, (clip) => {
    const was = befores.get(clip.id);
    const now = afters.get(clip.id);
    if (!was || !now) {
      return clip;
    }
    return changedKeys(now, was).reduce((c, key) => applyOverride(c, key, readField(now, key)), clip);
  });
}

export function liftEdit(source: MotionDoc, breakpointId: string, edited: MotionDoc): MotionDoc {
  if (breakpointId === BASE_BREAKPOINT) {
    return edited;
  }

  const sources = new Map(clipsOf(source).map((c) => [c.id, c]));
  const befores = new Map(clipsOf(cascaded(source, breakpointId).doc).map((c) => [c.id, c]));
  const lifted = mapTop(rescale(heightened(edited, source.height), source.width), (clip) => {
    const from = sources.get(clip.id);
    return from ? liftClip(clip, from, befores.get(clip.id)!, breakpointId) : clip;
  });
  return { ...lifted, width: source.width, breakpoints: source.breakpoints };
}

const heightened = (doc: MotionDoc, height: number) => (doc.height === height ? doc : restretched(doc, height));

export function resolveAt(doc: MotionDoc, breakpointId: string): MotionDoc {
  const { doc: applied, width, height } = cascaded(doc, breakpointId);
  const { breakpoints: _bps, ...rest } = rescale(mapClips(applied, (c) => withOverrides(c, undefined)), width);
  return heightened(rest as MotionDoc, height);
}

export const inView = (doc: MotionDoc, breakpointId: string): MotionDoc => (breakpointId === BASE_BREAKPOINT ? doc : resolveAt(doc, breakpointId));

export function overridesAt(doc: MotionDoc, clipId: string, breakpointId: string): OverrideKey[] {
  const clip = clipsOf(doc).find((c) => c.id === clipId);
  return Object.keys(clip?.overrides?.[breakpointId] ?? {}) as OverrideKey[];
}

export type MediaQuery = { breakpointId: string; maxWidth: number; clips: Record<string, ClipOverrides> };

export function mediaQueries(doc: MotionDoc): MediaQuery[] {
  return viewsOf(doc)
    .slice(1)
    .map((v) => ({ breakpointId: v.id, maxWidth: v.width, clips: Object.fromEntries(clipsOf(doc).flatMap((c) => (c.overrides?.[v.id] ? [[c.id, c.overrides[v.id]]] : []))) }))
    .filter((q) => Object.keys(q.clips).length > 0);
}
