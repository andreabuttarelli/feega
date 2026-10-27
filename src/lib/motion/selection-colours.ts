import { findClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { BRAND_COLORS } from '@feega/motion-core/motion/components';
import { setProps, type OpResult } from '@feega/motion-core/motion/timeline';

const HEX = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;

const TOKENS: ReadonlySet<string> = new Set(BRAND_COLORS);

export const isBrandToken = (colour: string) => TOKENS.has(colour);

const isColour = (value: string) => HEX.test(value) || TOKENS.has(value);

function coloursIn(value: unknown, into: string[]): string[] {
  if (typeof value === 'string' && isColour(value)) {
    into.push(value.toLowerCase());
    return into;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => coloursIn(v, into));
  }
  return into;
}

function swapped(value: unknown, from: string, to: string): unknown {
  if (typeof value === 'string') {
    return value.toLowerCase() === from ? to : value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => swapped(v, from, to));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, swapped(v, from, to)]));
  }
  return value;
}

export function selectionColours(doc: MotionDoc, ids: readonly string[]): string[] {
  const all = ids.flatMap((id) => coloursIn(findClip(doc, id)?.clip.props, []));
  return [...new Set(all)];
}

export function recolour(doc: MotionDoc, ids: readonly string[], from: string, to: string): OpResult {
  const target = from.toLowerCase();
  return ids.reduce<OpResult>((result, id) => {
    const clip = result.ok ? findClip(result.doc, id)?.clip : undefined;
    if (!result.ok || !clip || !coloursIn(clip.props, []).includes(target)) {
      return result;
    }
    return setProps(result.doc, id, swapped(clip.props, target, to) as Record<string, unknown>);
  }, { ok: true, doc });
}
