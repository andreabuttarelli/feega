import type { MotionClip, MotionDoc } from './doc';
import { CURSOR_PIECE, anchorBox, anchorsOf, startOf, type Box, type Point } from './clicks';
import { Ease } from './design';
import { TRANSFORM, type Keyframe } from './keyframes';
import { MaskKind, type MaskKey } from './mask';
import { pivotBox, pivotOf, transformAt } from './parent';
import { sampleTrack } from './sample-track';
import { setKeyframes, setMask, type OpResult } from './timeline';
import type { Rect } from './ui-kit/anchors';

export enum Isolate {
  Context = 'context',
  Part = 'part'
}

export type UiFocus = { clipId: string; anchor: string; at: number; frames: number; fill: number; isolate: Isolate };

type Values = { scale: number; x: number; y: number };
export type MaskBox = Record<'maskX' | 'maskY' | 'maskWidth' | 'maskHeight', number>;

const PART_MARGIN = 12;
const MASK_LEAD = 0.5;
const WHOLE: MaskBox = { maskX: 0.5, maskY: 0.5, maskWidth: 1, maskHeight: 1 };
const MASK_FIELD: Record<keyof MaskBox, 'x' | 'y' | 'width' | 'height'> = { maskX: 'x', maskY: 'y', maskWidth: 'width', maskHeight: 'height' };

const local = (origin: Point, scale: number, rect: Rect): Point => [origin[0] + (rect.x + rect.w / 2) * scale, origin[1] + (rect.y + rect.h / 2) * scale];

const reach = (span: number, pivot: number, centre: number) => {
  const away = centre - pivot;
  return away === 0 ? Infinity : (TRANSFORM.x.max * span + Math.sign(away) * (span / 2 - pivot)) / Math.abs(away);
};

function framed(clip: MotionClip, size: { width: number; height: number }, centre: Point, part: { w: number; h: number }, fill: number): Values {
  const [px, py] = pivotOf(clip, size);
  const scale = Math.min(fill * Math.min(size.width / part.w, size.height / part.h), TRANSFORM.scale.max, reach(size.width, px, centre[0]), reach(size.height, py, centre[1]));
  return { scale, x: (size.width / 2 - px - scale * (centre[0] - px)) / size.width, y: (size.height / 2 - py - scale * (centre[1] - py)) / size.height };
}

function partMask(clip: MotionClip, size: { width: number; height: number }, centre: Point, part: { w: number; h: number }): MaskBox {
  const box = pivotBox(clip.props, size);
  return { maskX: (centre[0] - box.left) / box.width, maskY: (centre[1] - box.top) / box.height, maskWidth: (part.w + 2 * PART_MARGIN) / box.width, maskHeight: (part.h + 2 * PART_MARGIN) / box.height };
}

export const maskAt = (clip: Pick<MotionClip, 'keyframes' | 'mask'>, key: keyof MaskBox, frame: number) => {
  const track = clip.keyframes[key];
  return track?.length ? sampleTrack(track, frame) : (clip.mask?.[MASK_FIELD[key]] ?? WHOLE[key]);
};

const move = (track: readonly Keyframe[] | undefined, start: number, end: number, from: number, to: number): Keyframe[] => [
  ...(track ?? []).filter((k) => k.frame < start),
  { frame: start, value: from, ease: Ease.Standard },
  { frame: end, value: to, ease: Ease.Standard }
];

function keyAll(doc: MotionDoc, clipId: string, start: number, end: number, from: Record<string, number>, to: Record<string, number>): OpResult {
  let result: OpResult = { ok: true, doc };
  for (const key of Object.keys(to)) {
    if (!result.ok) {
      return result;
    }
    const clip = anchorsOf(result.doc, clipId)!.place.clip;
    result = setKeyframes(result.doc, clipId, key, move(clip.keyframes[key], start, end, from[key], to[key]));
  }
  return result;
}

export function focusUi(doc: MotionDoc, focus: UiFocus): OpResult {
  const found = anchorsOf(doc, focus.clipId);
  if (!found) {
    return { ok: false, error: `${focus.clipId} is not a UI clip (add_ui or recreate_ui)` };
  }
  const rect = found.anchors[focus.anchor];
  if (!rect) {
    return { ok: false, error: `${focus.clipId} has no part "${focus.anchor}": its parts are ${Object.keys(found.anchors).join(', ') || 'none'}` };
  }

  const { place, origin, scale } = found;
  const clip = place.clip;
  const start = focus.at - startOf(place);
  const end = start + focus.frames;
  const frame = clip.from + start;
  const now: Values = { scale: transformAt(clip, 'scale', frame), x: transformAt(clip, 'x', frame), y: transformAt(clip, 'y', frame) };
  const centre = local(origin, scale, rect);
  const part = { w: rect.w * scale, h: rect.h * scale };

  const next = framed(clip, place.size, centre, part, focus.fill);
  const moved = keyAll(doc, focus.clipId, start, end, now, next);
  if (!moved.ok || (focus.isolate === Isolate.Context && !clip.mask)) {
    return moved;
  }

  const masked = clip.mask ? moved : setMask(moved.doc, focus.clipId, { kind: MaskKind.Rect, x: 0.5, y: 0.5, width: 1, height: 1 });
  if (!masked.ok) {
    return masked;
  }
  const target = focus.isolate === Isolate.Part ? partMask(clip, place.size, centre, part) : WHOLE;
  const current = Object.fromEntries((Object.keys(WHOLE) as (keyof MaskBox)[]).map((k) => [k, maskAt(clip, k, start)]));
  const lead = Math.round(focus.frames * MASK_LEAD);
  const [from, to] = next.scale > now.scale ? [start, start + lead] : [end - lead, end];
  return keyAll(masked.doc, focus.clipId, from, to, current, target satisfies Partial<Record<MaskKey, number>>);
}

const HELD_SECONDS = 1.5;
const MAX_PARTS = 2;
const MAX_PIECES = 2;
const SAMPLE_SECONDS = 0.25;

export type UiOverload = { clip?: MotionClip; at: number; detail: string };

const allClips = (doc: MotionDoc) => [doc.tracks, ...Object.values(doc.comps).map((c) => c.tracks)].flatMap((tracks) => tracks.flatMap((t) => t.clips as MotionClip[]));

const inFrame = (doc: MotionDoc, b: Box) => b.left >= -1 && b.top >= -1 && b.left + b.width <= doc.width + 1 && b.top + b.height <= doc.height + 1;

function unmasked(clip: MotionClip, size: { width: number; height: number }, centre: Point, frame: number): boolean {
  if (!clip.mask) {
    return true;
  }
  const box = pivotBox(clip.props, size);
  const at = (k: keyof MaskBox) => maskAt(clip, k, frame);
  const [mx, my] = [box.left + at('maskX') * box.width, box.top + at('maskY') * box.height];
  return Math.abs(centre[0] - mx) <= (at('maskWidth') * box.width) / 2 && Math.abs(centre[1] - my) <= (at('maskHeight') * box.height) / 2;
}

function partsShown(doc: MotionDoc, clipId: string, frame: number): number {
  const found = anchorsOf(doc, clipId)!;
  const clipFrame = frame - startOf(found.place);
  return Object.entries(found.anchors).filter(([anchor, rect]) => {
    const box = anchorBox(doc, clipId, anchor, frame);
    return box && inFrame(doc, box) && unmasked(found.place.clip, found.place.size, local(found.origin, found.scale, rect), clipFrame);
  }).length;
}

export function uiOverload(doc: MotionDoc): UiOverload[] {
  const pieces = allClips(doc).filter((c) => c.props.name !== CURSOR_PIECE && anchorsOf(doc, c.id));
  const step = Math.max(1, Math.round(SAMPLE_SECONDS * doc.fps));
  const held = new Map<string, number>();
  const named = new Set<string>();
  const found: UiOverload[] = [];

  for (let frame = 0; frame < doc.durationInFrames; frame += step) {
    const shown = pieces.filter((c) => {
      const start = startOf(anchorsOf(doc, c.id)!.place);
      return frame >= start && frame < start + c.durationInFrames;
    });
    if (shown.length > MAX_PIECES && !named.has('')) {
      named.add('');
      found.push({ clip: shown[0], at: frame, detail: `${shown.length} UI pieces on screen at once (${shown.map((c) => c.id).join(', ')}): show one or two at a time, one beat each` });
    }
    for (const clip of pieces) {
      const busy = shown.includes(clip) && partsShown(doc, clip.id, frame) > MAX_PARTS;
      const since = busy ? (held.get(clip.id) ?? frame) : undefined;
      held.delete(clip.id);
      if (since === undefined) {
        continue;
      }
      held.set(clip.id, since);
      if (frame - since > HELD_SECONDS * doc.fps && !named.has(clip.id)) {
        named.add(clip.id);
        found.push({ clip, at: since, detail: `${clip.id} holds its whole UI on screen for more than ${HELD_SECONDS} s: break it into beats of one part each (the field and its typed text, then the button, then the progress, then the result) with focus_ui, isolate on; the whole screen only briefly, as an establishing shot` });
      }
    }
  }
  return found;
}
