import { z } from 'zod';
import { ClipFamily } from './track-style';
import type { LayoutStore } from './editor-layout';
import { Control, Group } from './components';
import { VAR_PREFIX } from './custom/component';
import { FieldFill } from './number-field';
import { Source, type Transform } from './keyframes';
import { secondsLabel } from './inspector';
import { clipName } from './organize';
import type { MotionClip } from './doc';

export enum Section {
  Content = 'content',
  Layout = 'layout',
  Layer = 'layer',
  Fill = 'fill',
  Stroke = 'stroke',
  Text = 'text',
  Shape = 'shape',
  Effects = 'effects',
  Timing = 'timing',
  Animate = 'animate',
  ThreeD = '3d',
  Parent = 'parent'
}

export const SECTION_ORDER: readonly Section[] = [
  Section.Content,
  Section.Layout,
  Section.Layer,
  Section.Fill,
  Section.Stroke,
  Section.Shape,
  Section.Effects,
  Section.Text,
  Section.Timing,
  Section.Animate,
  Section.ThreeD,
  Section.Parent
];

export const SECTION_TITLE: Record<Section, string> = {
  [Section.Content]: 'Content',
  [Section.Layout]: 'Layout',
  [Section.Layer]: 'Layer',
  [Section.Fill]: 'Fill',
  [Section.Stroke]: 'Stroke',
  [Section.Text]: 'Text',
  [Section.Shape]: 'Path',
  [Section.Effects]: 'Effects',
  [Section.Timing]: 'Timing',
  [Section.Animate]: 'Animation',
  [Section.ThreeD]: '3D',
  [Section.Parent]: 'Parent & mask'
};

const OPEN_FIRST: ReadonlySet<Section> = new Set([Section.Content, Section.Layout, Section.Layer, Section.Fill, Section.Stroke, Section.Effects, Section.Text]);

const DEFAULT_OPEN = Object.fromEntries(SECTION_ORDER.map((s) => [s, OPEN_FIRST.has(s)])) as Record<Section, boolean>;

const FAMILY_OPEN: Partial<Record<ClipFamily, Partial<Record<Section, boolean>>>> = {
  [ClipFamily.ThreeD]: { [Section.ThreeD]: true }
};

export type SectionState = Partial<Record<ClipFamily, Partial<Record<Section, boolean>>>>;

export const isOpen = (state: SectionState, family: ClipFamily, section: Section): boolean => state[family]?.[section] ?? FAMILY_OPEN[family]?.[section] ?? DEFAULT_OPEN[section];

const STORAGE_KEY = 'motion-inspector-sections';
const stateSchema = z.partialRecord(z.enum(ClipFamily), z.partialRecord(z.enum(Section), z.boolean()));

export function readSections(store: LayoutStore | null): SectionState {
  try {
    const parsed = stateSchema.safeParse(JSON.parse(store?.getItem(STORAGE_KEY) ?? 'null'));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

export function flipSection(state: SectionState, family: ClipFamily, section: Section, store: LayoutStore | null): SectionState {
  const next = { ...state, [family]: { ...state[family], [section]: !isOpen(state, family, section) } };
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return next;
  }
  return next;
}

export enum Part {
  Transitions = 'transitions',
  Ducking = 'ducking',
  Pulse = 'pulse'
}

const ONLY_FOR: Partial<Record<Part, readonly ClipFamily[]>> = { [Part.Ducking]: [ClipFamily.Audio] };
const NOT_FOR: Partial<Record<Part, readonly ClipFamily[]>> = { [Part.Transitions]: [ClipFamily.Audio], [Part.Pulse]: [ClipFamily.Audio] };

export const shows = (part: Part, family: ClipFamily): boolean => (ONLY_FOR[part]?.includes(family) ?? true) && !NOT_FOR[part]?.includes(family);

const TRANSFORM_SECTION: Record<string, Section> = {
  z: Section.ThreeD,
  rotateX: Section.ThreeD,
  rotateY: Section.ThreeD,
  perspective: Section.ThreeD,
  opacity: Section.Layer,
  blur: Section.Layer
};

export const DIAL_KEYS: ReadonlySet<string> = new Set(['rotateX', 'rotateY', 'rotateZ']);

export const transformSection = (key: string): Section => TRANSFORM_SECTION[key] ?? Section.Layout;

const GROUP_SECTION: Record<Group, Section> = {
  [Group.Content]: Section.Content,
  [Group.Style]: Section.Content,
  [Group.Layout]: Section.Layout,
  [Group.Motion]: Section.Animate,
  [Group.Camera]: Section.ThreeD
};

const TEXT_KEYS: ReadonlySet<string> = new Set(['font', 'weight', 'fontWeight', 'italic', 'size', 'tracking', 'leading', 'textCase', 'stretch', 'slant', 'axes', 'align', 'sizing']);

const KEY_SECTION: Record<string, Section> = {
  opacity: Section.Layer,
  roundness: Section.Layer,
  corners: Section.Layer,
  smoothing: Section.Layer,
  fillKind: Section.Fill,
  fill2: Section.Fill,
  gradientAngle: Section.Fill,
  fillRule: Section.Fill,
  strokeKind: Section.Stroke,
  stroke: Section.Stroke,
  strokeWidth: Section.Stroke,
  dash: Section.Stroke,
  gap: Section.Stroke,
  cap: Section.Stroke,
  join: Section.Stroke
};

const CONTROL_SECTION: Partial<Record<Control, Section>> = {
  [Control.Color]: Section.Fill,
  [Control.Fills]: Section.Fill,
  [Control.Strokes]: Section.Stroke,
  [Control.Font]: Section.Text
};

export enum Typed {
  Yes = 'yes',
  No = 'no'
}

type Sorted = { key: string; control: Control; group: Group };

export function fieldSection(field: Sorted, typed: Typed): Section {
  if (typed === Typed.Yes && TEXT_KEYS.has(field.key)) {
    return Section.Text;
  }
  return KEY_SECTION[field.key] ?? CONTROL_SECTION[field.control] ?? GROUP_SECTION[field.group];
}

const UI_HIDDEN: ReadonlySet<string> = new Set([VAR_PREFIX]);

export const uiHidden = (key: string): boolean => UI_HIDDEN.has(key);

const SHADOWED_BY_TRANSFORM: Record<string, string> = { opacity: 'opacity', scale: 'scale', rotation: 'rotateZ' };

export const shadowed = (key: string, value: unknown, fallback: unknown, transformKeys: ReadonlySet<string>): boolean =>
  SHADOWED_BY_TRANSFORM[key] !== undefined && transformKeys.has(SHADOWED_BY_TRANSFORM[key]) && value === fallback;

export type FieldLook = { short: string | null; unit: string; fill: FieldFill };

const DEGREES = '°';
const EM = 'em';
const TIMES = '×';
const SECONDS = 's';

const LOOKS: Record<string, Partial<FieldLook>> = {
  x: { short: 'X' },
  y: { short: 'Y' },
  z: { short: 'Z' },
  scale: { short: 'Scale' },
  scaleX: { short: 'Scale X' },
  scaleY: { short: 'Scale Y' },
  width: { short: 'W' },
  height: { short: 'H' },
  rotation: { short: 'Rotate', unit: DEGREES },
  weight: { short: 'Weight' },
  fontWeight: { short: 'Weight' },
  size: { short: 'Size' },
  tracking: { short: 'Spacing', unit: EM },
  leading: { short: 'Line', unit: TIMES },
  rotateX: { short: 'Tilt X', unit: DEGREES },
  rotateY: { short: 'Tilt Y', unit: DEGREES },
  rotateZ: { short: 'Rotate', unit: DEGREES },
  skewX: { short: 'Skew X', unit: DEGREES },
  skewY: { short: 'Skew Y', unit: DEGREES },
  perspective: { short: 'Persp.', unit: 'px' },
  opacity: { short: 'Opacity', fill: FieldFill.Range },
  blur: { short: 'Blur', unit: 'px' },
  volume: { short: 'Volume', fill: FieldFill.Range },
  pan: { short: 'Pan' },
  fadeIn: { short: 'Fade in', unit: SECONDS },
  fadeOut: { short: 'Fade out', unit: SECONDS },
  objectRotateX: { short: 'Turn X', unit: DEGREES },
  objectRotateY: { short: 'Turn Y', unit: DEGREES },
  objectRotateZ: { short: 'Turn Z', unit: DEGREES },
  orbit: { short: 'Orbit', unit: DEGREES },
  fov: { short: 'FOV', unit: DEGREES }
};

const SOURCE_LOOKS: Partial<Record<Source, Record<string, Partial<FieldLook>>>> = {
  [Source.Transform]: { x: { short: 'Offset X' }, y: { short: 'Offset Y' } }
};

export function fieldLook(key: string, source: Source = Source.Prop): FieldLook {
  const look = { ...LOOKS[key], ...SOURCE_LOOKS[source]?.[key] };
  return { short: look.short ?? null, unit: look.unit ?? '', fill: look.fill ?? FieldFill.None };
}

type Summed = Pick<MotionClip, 'from' | 'durationInFrames' | 'component' | 'props' | 'parent'> & { transform: Transform; keyframes: Record<string, unknown[] | undefined>; effects: readonly unknown[]; mask: unknown };

const PERCENT = 100;
const SEP = ' · ';

const TRANSFORM_SUMMARY: [keyof Transform, (v: number) => string, number][] = [
  ['scale', (v) => `Scale ${Math.round(v * PERCENT)}%`, 1],
  ['rotateZ', (v) => `Rotate ${v}°`, 0],
  ['opacity', (v) => `Opacity ${Math.round(v * PERCENT)}%`, 1]
];

function layoutSummary(clip: Summed): string {
  return TRANSFORM_SUMMARY.filter(([key, , rest]) => clip.transform[key] !== undefined && clip.transform[key] !== rest)
    .map(([key, say]) => say(clip.transform[key] as number))
    .join(SEP);
}

const animated = (clip: Summed) => Object.values(clip.keyframes).filter((keys) => keys?.length).length;
const countOf = (n: number, noun: string) => (n ? `${n} ${noun}` : '');

const SUMMARY: Record<Section, (clip: Summed, fps: number) => string> = {
  [Section.Content]: (clip) => clipName(clip),
  [Section.Layout]: layoutSummary,
  [Section.Timing]: (clip, fps) => `At ${secondsLabel(clip.from, fps)}s${SEP}${secondsLabel(clip.durationInFrames, fps)}s long`,
  [Section.Shape]: () => '',
  [Section.Layer]: () => '',
  [Section.Fill]: () => '',
  [Section.Stroke]: () => '',
  [Section.Text]: () => '',
  [Section.Animate]: (clip) => countOf(animated(clip), 'animated'),
  [Section.Effects]: (clip) => countOf(clip.effects.length, 'effects'),
  [Section.ThreeD]: () => '',
  [Section.Parent]: (clip) => [clip.parent ? 'Parented' : '', clip.mask ? 'Masked' : ''].filter(Boolean).join(SEP)
};

export const sectionSummary = (section: Section, clip: Summed, fps: number): string => SUMMARY[section](clip, fps);
