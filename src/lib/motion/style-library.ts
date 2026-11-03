import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { applyStyle, defineStyle, stylesFor } from './styles';
import type { ComponentId } from '@feega/motion-core/motion/components';
import { StyleKind, type Style } from '@feega/motion-core/motion/styles-model';
import { EFFECTS } from '@feega/motion-core/motion/effects/registry';
import { FILL_LABEL } from '@feega/motion-core/motion/fill/model';
import type { OpResult } from '@feega/motion-core/motion/timeline';
import { spaceOf } from './units';

export type Library = Record<string, Style>;

type Sized = Pick<MotionDoc, 'width' | 'height'>;

const typeUnit = (doc: Sized) => Math.min(doc.width, doc.height);

const PX_PRECISION = 100;

export function inLibrary<S extends Style>(style: S, doc: Sized): S {
  if (style.kind !== StyleKind.Text || style.size === undefined) {
    return style;
  }
  const { size, ...rest } = style;
  return { ...rest, sizePx: Math.round(size * typeUnit(doc) * PX_PRECISION) / PX_PRECISION } as S;
}

export function inDoc<S extends Style>(style: S, doc: Sized): S {
  if (style.kind !== StyleKind.Text || style.sizePx === undefined) {
    return style;
  }
  const { sizePx, ...rest } = style;
  return { ...rest, size: sizePx / typeUnit(doc) } as S;
}

const DOC_PX = 1;

export type Placed = { doc: MotionDoc; scale: number };

export function libraryOf(frames: readonly Placed[]): Library {
  const library: Library = {};
  for (const { doc, scale } of frames) {
    for (const [name, style] of Object.entries(doc.styles ?? {})) {
      library[name] ??= inLibrary(style, spaceOf(doc, scale));
    }
  }
  return library;
}

export function adoptStyle(doc: MotionDoc, ids: readonly string[], name: string, style: Style, scale = DOC_PX): OpResult {
  const owned = doc.styles?.[name] ? { ok: true as const, doc } : defineStyle(doc, name, inDoc(style, spaceOf(doc, scale)));
  return owned.ok ? applyStyle(owned.doc, ids, name) : owned;
}

export function syncedDoc(doc: MotionDoc, name: string, style: Style, scale = DOC_PX): MotionDoc | null {
  if (!doc.styles?.[name]) {
    return null;
  }
  const defined = defineStyle(doc, name, inDoc(style, spaceOf(doc, scale)));
  return defined.ok ? defined.doc : null;
}

const inDocAll = (library: Library, frame: Sized): Library => Object.fromEntries(Object.entries(library).map(([name, style]) => [name, inDoc(style, frame)]));

const GROUP_SEP = '/';

export function folderOf(name: string): { group: string; leaf: string } {
  const parts = name.split(GROUP_SEP).map((part) => part.trim());
  return { group: parts.slice(0, -1).join(` ${GROUP_SEP} `), leaf: parts.at(-1)! };
}

export function foldered<T extends readonly [string, unknown]>(rows: readonly T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const { group } = folderOf(row[0]);
    groups.set(group, [...(groups.get(group) ?? []), row]);
  }
  return [...groups.values()].flat();
}

export const colourStyles = (library: Library): { name: string; color: string }[] => Object.entries(library).flatMap(([name, style]) => (style.kind === StyleKind.Colour ? [{ name, color: style.color }] : []));

export const offeredStyles = (doc: MotionDoc, component: ComponentId, library: Library, scale = DOC_PX) =>
  stylesFor({ ...doc, styles: { ...inDocAll(library, spaceOf(doc, scale)), ...doc.styles } }, component).map((s) => ({ name: s.name, style: s.style, shared: !doc.styles?.[s.name] }));

const LABEL: { [K in StyleKind]: (style: Extract<Style, { kind: K }>) => string } = {
  [StyleKind.Text]: (style) => `${style.font ?? ''} ${style.weight ?? ''}`.trim() || 'Text',
  [StyleKind.Colour]: () => 'Colour',
  [StyleKind.Paint]: (style) => style.fills.map((f) => FILL_LABEL[f.type]).join(' + '),
  [StyleKind.Effect]: (style) => style.effects.map((e) => EFFECTS[e.kind].label).join(' + ')
};

export const styleLabel = (style: Style): string => (LABEL[style.kind] as (style: Style) => string)(style);
