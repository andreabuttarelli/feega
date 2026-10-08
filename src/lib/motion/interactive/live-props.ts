import type { ComponentId } from '../components';
import { Source, ValueKind, animProp, type AnimProp, type Keyframe } from '../keyframes';
import { readsInput } from '../expression/inputs';
import { GLASS_NUMBER_KEYS } from '../glass/model';
import { glassTint, glassValues } from '../glass/pose';
import { BLOB_NUMBER_KEYS } from '../blob/model';
import { blobTint, blobValues } from '../blob/pose';
import { LensKind, LivePaint, type LensSpec } from './paint';

export type LensClip = { id: string; from: number; durationInFrames: number; props: Record<string, unknown>; keyframes: Record<string, Keyframe[] | undefined> };

type Lens = { kind: LensKind; keys: readonly string[]; values: (clip: LensClip, frame: number) => Record<string, number>; tint: (clip: LensClip, frame: number, resolve: (v: string) => string) => string };

const LENSES: Partial<Record<ComponentId, Lens>> = {
  LiquidGlass: { kind: LensKind.Glass, keys: GLASS_NUMBER_KEYS, values: glassValues, tint: glassTint },
  LiquidBlob: { kind: LensKind.Blob, keys: BLOB_NUMBER_KEYS, values: blobValues, tint: blobTint }
};

const STYLE = () => LivePaint.Style;
const FROZEN = () => null;

const SOURCE_PAINT: Record<Source, (component: ComponentId) => LivePaint | null> = {
  [Source.Transform]: STYLE,
  [Source.Prop]: STYLE,
  [Source.Param]: (component) => (LENSES[component] ? LivePaint.Lens : null),
  [Source.Scene]: FROZEN,
  [Source.Mask]: FROZEN,
  [Source.Effect]: FROZEN,
  [Source.Animator]: FROZEN,
  [Source.Modifier]: FROZEN,
  [Source.Remap]: FROZEN,
  [Source.Sound]: FROZEN,
  [Source.Layout]: FROZEN,
  [Source.TextPath]: FROZEN
};

export function paintOf(component: ComponentId, prop: AnimProp): LivePaint | null {
  return prop.kind === ValueKind.Number ? SOURCE_PAINT[prop.source](component) : null;
}

export function liveInputProblem(clip: { component: ComponentId; params?: readonly AnimProp[] }, key: string, source: string): string | null {
  const prop = animProp(clip.component, key, clip.params);
  if (!readsInput(source) || !prop || paintOf(clip.component, prop)) {
    return null;
  }
  return `${key}: the interactive export cannot drive ${clip.component} ${key} live, so input.* would stay frozen at its default. Live input drives transforms, number props and liquid glass/blob props; use keyframes or time-based expressions here`;
}

const compact = <T>(series: T[]): T[] => (series.every((v) => v === series[0]) ? series.slice(0, 1) : series);

export function lensSpec(component: ComponentId, clip: LensClip, resolve: (v: string) => string): LensSpec | null {
  const lens = LENSES[component];
  if (!lens) {
    return null;
  }

  const frames = Array.from({ length: Math.max(clip.durationInFrames, 1) }, (_, f) => f);
  const values = frames.map((f) => lens.values(clip, f));
  return {
    id: clip.id,
    kind: lens.kind,
    from: clip.from,
    length: frames.length,
    base: Object.fromEntries(lens.keys.map((key) => [key, compact(values.map((v) => v[key]))])),
    tint: compact(frames.map((f) => lens.tint(clip, f, resolve)))
  };
}
