import { MotionFormat, type MotionClip, type MotionDoc } from './doc';
import { setCanvas, type CanvasSize, type OpResult } from './timeline';

export const CREATE_FORMATS = [MotionFormat.Square, MotionFormat.Portrait, MotionFormat.Vertical, MotionFormat.Landscape] as const;

export type FormatTarget = { format: MotionFormat } | { size: CanvasSize };

const FULL_BLEED = 0.95;

type Fit = { kx: number; ky: number; text: number; px: number };

type Rescale = (value: number, fit: Fit) => number;

const PROP_RESCALE: Record<string, Rescale> = {
  x: (v, f) => 0.5 + (v - 0.5) * f.kx,
  y: (v, f) => 0.5 + (v - 0.5) * f.ky,
  width: (v, f) => v * f.kx,
  height: (v, f) => v * f.ky,
  size: (v, f) => v * f.text
};

const MOVE_RESCALE: Record<string, Rescale> = {
  x: (v, f) => v * f.kx,
  y: (v, f) => v * f.ky
};

const KEYFRAME_RESCALE: Record<string, Rescale> = { ...MOVE_RESCALE, width: PROP_RESCALE.width, height: PROP_RESCALE.height, size: PROP_RESCALE.size };

const isFullBleed = (props: Record<string, unknown>) => Number(props.width) >= FULL_BLEED && Number(props.height) >= FULL_BLEED;

function rescaled<T extends Record<string, unknown>>(values: T, table: Record<string, Rescale>, fit: Fit): T {
  const next: Record<string, unknown> = { ...values };
  for (const [key, rescale] of Object.entries(table)) {
    if (typeof next[key] === 'number') {
      next[key] = rescale(next[key] as number, fit);
    }
  }
  return next as T;
}

function spaced(clip: MotionClip, fit: Fit): Pick<MotionClip, 'autoLayout'> {
  const layout = clip.autoLayout;
  if (!layout) {
    return {};
  }
  const padding = Object.fromEntries(Object.entries(layout.padding).map(([side, v]) => [side, v * fit.px])) as typeof layout.padding;
  return { autoLayout: { ...layout, gap: layout.gap * fit.px, crossGap: layout.crossGap * fit.px, padding } };
}

function refit(clip: MotionClip, fit: Fit): MotionClip {
  if (isFullBleed(clip.props)) {
    return { ...clip, ...spaced(clip, fit) };
  }

  const keyframes = Object.fromEntries(Object.entries(clip.keyframes).map(([key, track]) => [key, KEYFRAME_RESCALE[key] ? track.map((k) => ({ ...k, value: typeof k.value === 'number' ? KEYFRAME_RESCALE[key](k.value, fit) : k.value })) : track]));
  return { ...clip, ...spaced(clip, fit), props: rescaled(clip.props, PROP_RESCALE, fit), transform: rescaled(clip.transform, MOVE_RESCALE, fit), keyframes };
}

export function reformat(doc: MotionDoc, target: FormatTarget): OpResult {
  const sized = setCanvas(doc, target);
  if (!sized.ok) {
    return sized;
  }

  const { width, height } = sized.doc;
  const s = Math.min(width / doc.width, height / doc.height);
  const fit: Fit = { kx: (doc.width * s) / width, ky: (doc.height * s) / height, text: (s * Math.min(doc.width, doc.height)) / Math.min(width, height), px: s };
  return { ok: true, doc: { ...sized.doc, tracks: sized.doc.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => refit(c as MotionClip, fit)) })) } };
}
