import { z } from 'zod';
import { ClipFamily } from './track-style';
import type { LayoutStore } from './editor-layout';
import { Group } from './components';
import { FieldFill } from './number-field';
import { Source } from './keyframes';

export enum Section {
  Content = 'content',
  Style = 'style',
  Layout = 'layout',
  Timing = 'timing',
  Shape = 'shape',
  Animate = 'animate',
  Effects = 'effects',
  ThreeD = '3d',
  Parent = 'parent'
}

export const SECTION_ORDER: readonly Section[] = [Section.Content, Section.Style, Section.Layout, Section.Timing, Section.Shape, Section.Animate, Section.Effects, Section.ThreeD, Section.Parent];

export const SECTION_TITLE: Record<Section, string> = {
  [Section.Content]: 'Content',
  [Section.Style]: 'Style',
  [Section.Layout]: 'Layout',
  [Section.Timing]: 'Timing',
  [Section.Shape]: 'Path & modifiers',
  [Section.Animate]: 'Animate',
  [Section.Effects]: 'Effects & blend',
  [Section.ThreeD]: '3D',
  [Section.Parent]: 'Parent & mask'
};

const DEFAULT_OPEN: Record<Section, boolean> = {
  [Section.Content]: true,
  [Section.Style]: true,
  [Section.Layout]: true,
  [Section.Timing]: true,
  [Section.Shape]: true,
  [Section.Animate]: false,
  [Section.Effects]: false,
  [Section.ThreeD]: false,
  [Section.Parent]: false
};

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

const THREE_D_TRANSFORM: ReadonlySet<string> = new Set(['z', 'rotateX', 'rotateY', 'perspective']);

export const DIAL_KEYS: ReadonlySet<string> = new Set(['rotateX', 'rotateY', 'rotateZ']);

export const transformSection = (key: string): Section => (THREE_D_TRANSFORM.has(key) ? Section.ThreeD : Section.Layout);

export const GROUP_SECTION: Record<Group, Section> = {
  [Group.Content]: Section.Content,
  [Group.Style]: Section.Style,
  [Group.Layout]: Section.Layout,
  [Group.Motion]: Section.Animate,
  [Group.Camera]: Section.ThreeD
};

export type FieldLook = { glyph: string | null; unit: string; fill: FieldFill };

const DEGREES = '°';

const LOOKS: Record<string, Partial<FieldLook>> = {
  x: { glyph: 'X' },
  y: { glyph: 'Y' },
  z: { glyph: 'Z' },
  scale: { glyph: '⤢' },
  scaleX: { glyph: 'SX' },
  scaleY: { glyph: 'SY' },
  width: { glyph: 'W' },
  height: { glyph: 'H' },
  rotation: { glyph: '↻', unit: DEGREES },
  weight: { glyph: 'W' },
  size: { glyph: 'S' },
  tracking: { glyph: '↔' },
  leading: { glyph: '↕' },
  rotateX: { glyph: 'RX', unit: DEGREES },
  rotateY: { glyph: 'RY', unit: DEGREES },
  rotateZ: { glyph: '↻', unit: DEGREES },
  skewX: { glyph: 'KX', unit: DEGREES },
  skewY: { glyph: 'KY', unit: DEGREES },
  perspective: { glyph: 'P', unit: 'px' },
  opacity: { glyph: 'α', fill: FieldFill.Range },
  blur: { glyph: '◌', unit: 'px' },
  volume: { glyph: 'V', fill: FieldFill.Range },
  pan: { glyph: 'L/R' },
  fadeIn: { glyph: '↗', unit: 's' },
  fadeOut: { glyph: '↘', unit: 's' },
  objectRotateX: { glyph: 'RX', unit: DEGREES },
  objectRotateY: { glyph: 'RY', unit: DEGREES },
  objectRotateZ: { glyph: 'RZ', unit: DEGREES },
  orbit: { glyph: '⟳', unit: DEGREES },
  fov: { glyph: 'FOV', unit: DEGREES }
};

const SOURCE_LOOKS: Partial<Record<Source, Record<string, Partial<FieldLook>>>> = {
  [Source.Transform]: { x: { glyph: 'ΔX' }, y: { glyph: 'ΔY' } }
};

export function fieldLook(key: string, source: Source = Source.Prop): FieldLook {
  const look = { ...LOOKS[key], ...SOURCE_LOOKS[source]?.[key] };
  return { glyph: look.glyph ?? null, unit: look.unit ?? '', fill: look.fill ?? FieldFill.None };
}
