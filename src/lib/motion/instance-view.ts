import type { MotionClip, MotionComp, MotionDoc } from '@feega/motion-core/motion/doc';
import { instanceOf, innerClips, type Overrides } from './main-component';
import { CLIP_LEVEL_OVERRIDES, mergeView, overridden, viewOf, type CompPath } from '@feega/motion-core/motion/precomp';
import { setProps } from '@feega/motion-core/motion/timeline';

export type Hosted = { path: CompPath; hosts: readonly string[] };

const same = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true;
  }
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b || Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
};

const valuesOf = (clip: MotionClip): Record<string, unknown> => ({ ...clip.props, ...Object.fromEntries(CLIP_LEVEL_OVERRIDES.map((k) => [k, clip[k]])) });

export function overridesFrom(main: MotionComp, shown: readonly MotionClip[]): Overrides {
  const entries = innerClips(main).flatMap((base) => {
    const view = shown.find((c) => c.id === base.id);
    if (!view) {
      return [];
    }
    const was = valuesOf(base);
    const now = valuesOf(view);
    const changed = Object.fromEntries(Object.keys({ ...was, ...now }).filter((k) => !same(was[k], now[k])).map((k) => [k, now[k]]));
    return Object.keys(changed).length ? [[base.id, changed] as const] : [];
  });
  return Object.fromEntries(entries);
}

const parentOf = (doc: MotionDoc, scope: Hosted) => viewOf(doc, scope.path.slice(0, -1));

function instanceAt(doc: MotionDoc, scope: Hosted) {
  const hostId = scope.hosts.at(-1);
  return hostId === undefined ? null : instanceOf(parentOf(doc, scope), hostId);
}

export function scopeView(doc: MotionDoc, scope: Hosted): MotionDoc {
  const instance = instanceAt(doc, scope);
  const view = viewOf(doc, scope.path);
  return instance ? { ...view, tracks: overridden(view.tracks as never, instance.clip) } : view;
}

export function mergeScope(doc: MotionDoc, scope: Hosted, view: MotionDoc): MotionDoc {
  const instance = instanceAt(doc, scope);
  if (!instance) {
    return mergeView(doc, scope.path, view);
  }
  const overrides = overridesFrom(instance.comp, view.tracks.flatMap((t) => t.clips as MotionClip[]));
  const parent = parentOf(doc, scope);
  const set = setProps(parent, instance.clip.id, { overrides: Object.keys(overrides).length ? overrides : undefined });
  const edited = set.ok ? set.doc : parent;
  return mergeView(doc, scope.path.slice(0, -1), { ...edited, assets: view.assets, fonts: view.fonts, components: view.components, fields: view.fields, interactive: view.interactive, comps: view.comps });
}
