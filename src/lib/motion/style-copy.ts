import { z } from 'zod';
import { COMPONENTS, type ComponentId } from './components';
import type { MotionClip, MotionDoc } from './doc';
import { editClip, setProps, type OpResult } from './timeline';

const STYLE_PROPS = ['fills', 'strokes', 'color', 'background', 'font', 'weight', 'italic', 'size', 'tracking', 'leading', 'textCase', 'stretch', 'slant', 'axes', 'radius'] as const;

export type CopiedStyle = { props: Record<string, unknown>; effects: MotionClip['effects']; blend: MotionClip['blend'] };

const accepted = new Map<ComponentId, ReadonlySet<string>>();

function propsOf(id: ComponentId): ReadonlySet<string> {
  const known = accepted.get(id);
  if (known) {
    return known;
  }
  const json = z.toJSONSchema(COMPONENTS[id].schema, { io: 'input' }) as { properties?: Record<string, unknown> };
  const keys = new Set(Object.keys(json.properties ?? {}));
  accepted.set(id, keys);
  return keys;
}

export function copyStyle(clip: MotionClip): CopiedStyle {
  const props = Object.fromEntries(STYLE_PROPS.filter((key) => clip.props[key] !== undefined).map((key) => [key, clip.props[key]]));
  return { props, effects: clip.effects, blend: clip.blend };
}

function pasteOne(doc: MotionDoc, clip: MotionClip, style: CopiedStyle): OpResult {
  const fits = propsOf(clip.component as ComponentId);
  const patch = Object.fromEntries(Object.entries(style.props).filter(([key]) => fits.has(key)));
  const propped = Object.keys(patch).length ? setProps(doc, clip.id, patch) : ({ ok: true, doc } as OpResult);
  if (!propped.ok) {
    return propped;
  }
  return editClip(propped.doc, clip.id, (c) => ({ ...c, effects: style.effects, blend: style.blend }));
}

export function pasteStyle(doc: MotionDoc, ids: readonly string[], style: CopiedStyle): OpResult {
  return ids.reduce<OpResult>((result, id) => {
    if (!result.ok) {
      return result;
    }
    const clip = result.doc.tracks.flatMap((t) => t.clips).find((c) => c.id === id);
    return clip ? pasteOne(result.doc, clip, style) : result;
  }, { ok: true, doc });
}
