import { sampleColor, sampleTrack, type Keyframe } from '../keyframes';
import { GLASS_NUMBERS, GLASS_NUMBER_KEYS, GLASS_TINT, type GlassNumberKey } from './model';
import { glassShape, type GlassPose, type GlassSize, type GlassValues } from './shape';

type GlassClip = { props: Record<string, unknown>; keyframes: Record<string, Keyframe[] | undefined> };

const valueAt = (clip: GlassClip, key: GlassNumberKey, frame: number) => {
  const track = clip.keyframes[key];
  return track?.length ? sampleTrack(track, frame) : Number(clip.props[key] ?? GLASS_NUMBERS[key].fallback);
};

export function glassValues(clip: GlassClip, frame: number): GlassValues {
  return Object.fromEntries(GLASS_NUMBER_KEYS.map((key) => [key, valueAt(clip, key, frame)])) as GlassValues;
}

export function glassTint(clip: GlassClip, frame: number, resolve: (v: string) => string): string {
  const track = clip.keyframes[GLASS_TINT.key];
  return track?.length ? sampleColor(track, frame, resolve) : resolve(String(clip.props[GLASS_TINT.key] ?? GLASS_TINT.fallback));
}

export function glassPose(clip: GlassClip, frame: number, at: GlassSize, resolve: (v: string) => string): GlassPose {
  return glassShape(glassValues(clip, frame), glassTint(clip, frame, resolve), frame, at);
}
