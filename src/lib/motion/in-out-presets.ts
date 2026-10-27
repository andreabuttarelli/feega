import { Ease } from "@feega/motion-core/motion/design";
import {
  findClip,
  type MotionClip,
  type MotionDoc,
} from "@feega/motion-core/motion/doc";
import { withParams } from "@feega/motion-core/motion/custom/params";
import { animProp, type Keyframe } from "@feega/motion-core/motion/keyframes";
import {
  TEXT_COMPONENTS,
  TextPreset,
  applyPreset as applyTextPreset,
} from "@feega/motion-core/motion/text-animators/ops";
import {
  setKeyframes,
  type OpResult,
} from "@feega/motion-core/motion/timeline";
import { spliced } from "./animate-to";
import { valueAt } from "./inspector";

export enum PresetSide {
  In = "in",
  Out = "out",
}

export enum InOutPreset {
  Fade = "fade",
  SlideUp = "slide-up",
  SlideDown = "slide-down",
  SlideLeft = "slide-left",
  SlideRight = "slide-right",
  Scale = "scale",
  BlurIn = "blur",
  Pop = "pop",
  Typewriter = "typewriter",
}

type Hidden = (rest: number, side: PresetSide) => number;
type Shared = { label: string; seconds: number; sides: readonly PresetSide[] };
type TrackSpec = Shared & { hidden: Record<string, Hidden> };
type TextSpec = Shared & { text: TextPreset };
type Span = { start: number; end: number };

const SLIDE = 0.12;
const BLUR = 20;
const SCALE_FROM = 0.85;
const POP_FROM = 0.5;
const BOTH = [PresetSide.In, PresetSide.Out] as const;
const gone: Hidden = () => 0;
const shifted =
  (by: number): Hidden =>
  (rest) =>
    rest + by;
const travel =
  (by: number): Hidden =>
  (rest, side) =>
    side === PresetSide.In ? rest + by : rest - by;
const scaled =
  (by: number): Hidden =>
  (rest) =>
    rest * by;

export const IN_OUT_PRESETS: Record<InOutPreset, TrackSpec | TextSpec> = {
  [InOutPreset.Fade]: {
    label: "Fade",
    seconds: 0.6,
    sides: BOTH,
    hidden: { opacity: gone },
  },
  [InOutPreset.SlideUp]: {
    label: "Slide up",
    seconds: 0.7,
    sides: BOTH,
    hidden: { opacity: gone, y: travel(SLIDE) },
  },
  [InOutPreset.SlideDown]: {
    label: "Slide down",
    seconds: 0.7,
    sides: BOTH,
    hidden: { opacity: gone, y: travel(-SLIDE) },
  },
  [InOutPreset.SlideLeft]: {
    label: "Slide left",
    seconds: 0.7,
    sides: BOTH,
    hidden: { opacity: gone, x: travel(SLIDE) },
  },
  [InOutPreset.SlideRight]: {
    label: "Slide right",
    seconds: 0.7,
    sides: BOTH,
    hidden: { opacity: gone, x: travel(-SLIDE) },
  },
  [InOutPreset.Scale]: {
    label: "Scale",
    seconds: 0.7,
    sides: BOTH,
    hidden: { opacity: gone, scale: scaled(SCALE_FROM) },
  },
  [InOutPreset.BlurIn]: {
    label: "Blur",
    seconds: 0.8,
    sides: BOTH,
    hidden: { opacity: gone, blur: shifted(BLUR) },
  },
  [InOutPreset.Pop]: {
    label: "Pop",
    seconds: 0.5,
    sides: BOTH,
    hidden: { opacity: gone, scale: scaled(POP_FROM) },
  },
  [InOutPreset.Typewriter]: {
    label: "Typewriter",
    seconds: 1.2,
    sides: [PresetSide.In],
    text: TextPreset.Typewriter,
  },
};

export type InOutOptions = {
  preset: InOutPreset;
  side: PresetSide;
  duration?: number;
  at?: number;
};

const fail = (error: string): OpResult => ({ ok: false, error });

export function presetsFor(component: string, side: PresetSide): InOutPreset[] {
  const isText = TEXT_COMPONENTS.has(component);

  return (Object.keys(IN_OUT_PRESETS) as InOutPreset[]).filter((id) => {
    const spec = IN_OUT_PRESETS[id];

    return spec.sides.includes(side) && (!("text" in spec) || isText);
  });
}

export const defaultFrames = (preset: InOutPreset, fps: number) =>
  Math.max(1, Math.round(IN_OUT_PRESETS[preset].seconds * fps));

function spanOf(
  clip: MotionClip,
  side: PresetSide,
  duration: number,
  at: number | undefined,
): Span {
  const last = Math.max(0, clip.durationInFrames - 1);
  if (at !== undefined) {
    const start = Math.min(Math.max(0, Math.round(at)), last);

    return { start, end: start + duration };
  }
  if (side === PresetSide.In) {
    return { start: 0, end: duration };
  }

  return { start: Math.max(0, last - duration), end: last };
}

function settledFrame(
  track: readonly Keyframe[],
  side: PresetSide,
  span: Span,
): number {
  if (side === PresetSide.In) {
    return track.find((k) => k.frame > span.end)?.frame ?? span.end;
  }

  return (
    [...track].reverse().find((k) => k.frame < span.start)?.frame ?? span.start
  );
}

function keyed(
  clip: MotionClip,
  doc: MotionDoc,
  prop: string,
  hide: Hidden,
  side: PresetSide,
  span: Span,
): { from: Keyframe; to: Keyframe } | null {
  const withDefs = withParams(doc, clip);
  if (!animProp(clip.component, prop, withDefs.params)) {
    return null;
  }
  const restFrame = side === PresetSide.In ? span.end : span.start;
  const rest = valueAt(
    withDefs,
    prop,
    clip.from + settledFrame(clip.keyframes[prop] ?? [], side, span),
    (c) => c,
  );
  if (typeof rest !== "number") {
    return null;
  }
  const shown = { frame: restFrame, value: rest, ease: Ease.Standard };
  const away = {
    frame: side === PresetSide.In ? span.start : span.end,
    value: hide(rest, side),
    ease: Ease.Standard,
  };

  return side === PresetSide.In
    ? { from: away, to: shown }
    : { from: shown, to: away };
}

function shiftTracks(
  doc: MotionDoc,
  clip: MotionClip,
  spec: TrackSpec,
  side: PresetSide,
  span: Span,
): OpResult {
  let result: OpResult = { ok: true, doc };

  for (const [prop, hide] of Object.entries(spec.hidden)) {
    if (!result.ok) {
      return result;
    }
    const pair = keyed(clip, doc, prop, hide, side, span);
    if (!pair) {
      continue;
    }
    const track = findClip(result.doc, clip.id)!.clip.keyframes[prop] ?? [];
    result = setKeyframes(
      result.doc,
      clip.id,
      prop,
      spliced(track, pair.from, pair.to),
    );
  }

  return result;
}

export function applyInOut(
  doc: MotionDoc,
  clipId: string,
  options: InOutOptions,
  newId: () => string,
): OpResult {
  const found = findClip(doc, clipId);
  if (!found) {
    return fail(`no clip ${clipId}`);
  }
  const spec = IN_OUT_PRESETS[options.preset];
  if (!spec.sides.includes(options.side)) {
    return fail(`${options.preset} only goes ${spec.sides.join(" and ")}`);
  }
  if (
    !presetsFor(found.clip.component, options.side).includes(options.preset)
  ) {
    return fail(
      `${options.preset} needs a text clip; ${found.clip.component} is not one`,
    );
  }
  const duration = Math.max(
    1,
    Math.round(options.duration ?? defaultFrames(options.preset, doc.fps)),
  );
  const span = spanOf(found.clip, options.side, duration, options.at);
  if ("text" in spec) {
    return applyTextPreset(
      doc,
      clipId,
      spec.text,
      { start: span.start, duration },
      newId(),
    );
  }

  return shiftTracks(doc, found.clip, spec, options.side, span);
}
