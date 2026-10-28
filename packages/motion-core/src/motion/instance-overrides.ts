import type { MotionClip, MotionComp, MotionTrack } from './doc';
import { propertyOverride, type PropertyValues } from './property-resolve';

type Overrides = Record<string, Record<string, unknown>>;

export const CLIP_LEVEL_OVERRIDES = ['hidden', 'effects', 'transform'] as const;

export function withOverride(clip: MotionClip, override: Record<string, unknown>): MotionClip {
  const level = Object.fromEntries(CLIP_LEVEL_OVERRIDES.filter((k) => k in override).map((k) => [k, override[k]]));
  const props = Object.fromEntries(Object.entries(override).filter(([k]) => !(CLIP_LEVEL_OVERRIDES as readonly string[]).includes(k)));
  return { ...clip, ...level, props: { ...clip.props, ...props } };
}

export function overridden(tracks: MotionTrack[], host: MotionClip, main?: MotionComp['component']): MotionTrack[] {
  const overrides = host.props.overrides as Overrides | undefined;
  const values = host.props.propValues as PropertyValues | undefined;
  if (!overrides && !main?.properties) {
    return tracks;
  }
  const merged = (c: MotionClip) => ({ ...propertyOverride(main, values, c), ...overrides?.[c.id] });
  return tracks.map((t) => ({ ...t, clips: (t.clips as MotionClip[]).map((c) => (Object.keys(merged(c)).length ? withOverride(c, merged(c)) : c)) }));
}
