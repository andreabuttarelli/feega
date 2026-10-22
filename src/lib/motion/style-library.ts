import type { MotionDoc } from './doc';
import { applyStyle, defineStyle, stylesFor } from './styles';
import type { ComponentId } from './components';
import type { Style } from './styles-model';
import type { OpResult } from './timeline';

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
