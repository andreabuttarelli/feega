import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { applyStyle, defineStyle, stylesFor } from './styles';
import type { ComponentId } from '@feega/motion-core/motion/components';
import { StyleKind, type Style } from '@feega/motion-core/motion/styles-model';
import { EFFECTS } from '@feega/motion-core/motion/effects/registry';
import { FILL_LABEL } from '@feega/motion-core/motion/fill/model';
import type { OpResult } from '@feega/motion-core/motion/timeline';

export type Library = Record<string, Style>;

export function libraryOf(docs: readonly MotionDoc[]): Library {
  const library: Library = {};
  for (const doc of docs) {
    for (const [name, style] of Object.entries(doc.styles ?? {})) {
      library[name] ??= style;
    }
  }
  return library;
}

export function adoptStyle(doc: MotionDoc, ids: readonly string[], name: string, style: Style): OpResult {
  const owned = doc.styles?.[name] ? { ok: true as const, doc } : defineStyle(doc, name, style);
  return owned.ok ? applyStyle(owned.doc, ids, name) : owned;
}

export function syncedDoc(doc: MotionDoc, name: string, style: Style): MotionDoc | null {
  if (!doc.styles?.[name]) {
    return null;
  }
  const defined = defineStyle(doc, name, style);
  return defined.ok ? defined.doc : null;
}

export const offeredStyles = (doc: MotionDoc, component: ComponentId, library: Library) => stylesFor({ ...doc, styles: { ...library, ...doc.styles } }, component).map((s) => ({ name: s.name, style: s.style, shared: !doc.styles?.[s.name] }));

const LABEL: { [K in StyleKind]: (style: Extract<Style, { kind: K }>) => string } = {
  [StyleKind.Text]: (style) => `${style.font ?? ''} ${style.weight ?? ''}`.trim() || 'Text',
  [StyleKind.Colour]: () => 'Colour',
  [StyleKind.Paint]: (style) => style.fills.map((f) => FILL_LABEL[f.type]).join(' + '),
  [StyleKind.Effect]: (style) => style.effects.map((e) => EFFECTS[e.kind].label).join(' + ')
};

export const styleLabel = (style: Style): string => (LABEL[style.kind] as (style: Style) => string)(style);
