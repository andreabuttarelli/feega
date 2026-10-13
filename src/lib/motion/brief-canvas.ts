import { FORMATS, MotionFormat, clipsOf, type MotionDoc } from './doc';
import { MAX_SECONDS } from './design';
import { setCanvas } from './timeline';

export type BriefCanvas = { format?: MotionFormat; seconds?: number };

const FORMAT_CUES: readonly (readonly [RegExp, MotionFormat])[] = [
  [/\b1440\s*[x×]\s*1440\b/i, MotionFormat.SquareLarge],
  [/\b1080\s*[x×]\s*1080\b/i, MotionFormat.Square],
  [/\b1920\s*[x×]\s*1080\b/i, MotionFormat.Landscape],
  [/\b1080\s*[x×]\s*1920\b/i, MotionFormat.Vertical],
  [/\b1080\s*[x×]\s*1350\b/i, MotionFormat.Portrait],
  [/\b1\s*:\s*1\b/, MotionFormat.Square],
  [/\b16\s*:\s*9\b/, MotionFormat.Landscape],
  [/\b9\s*:\s*16\b/, MotionFormat.Vertical],
  [/\b4\s*:\s*5\b/, MotionFormat.Portrait],
  [/\b(square|quadrat[oa])\b/i, MotionFormat.Square],
  [/\b(vertical|verticale|reels?|stor(y|ies)|tiktok|shorts)\b/i, MotionFormat.Vertical],
  [/\b(landscape|horizontal|orizzontale|youtube)\b/i, MotionFormat.Landscape],
  [/\bportrait\b/i, MotionFormat.Portrait]
];

const SECONDS = /\b(\d{1,3}(?:[.,]\d+)?)\s*-?\s*(?:s|sec|secs|seconds?|secondi|secondo)\b/i;

export function briefCanvas(message: string): BriefCanvas {
  const format = FORMAT_CUES.find(([cue]) => cue.test(message))?.[1];
  const said = SECONDS.exec(message)?.[1];
  const seconds = said ? Number(said.replace(',', '.')) : undefined;
  return {
    ...(format ? { format } : {}),
    ...(seconds && seconds <= MAX_SECONDS ? { seconds } : {})
  };
}

export function sizedToBrief(doc: MotionDoc, message: string): MotionDoc | null {
  if (clipsOf(doc).length) {
    return null;
  }
  const asked = briefCanvas(message);
  const size = asked.format ? FORMATS[asked.format] : null;
  const durationInFrames = asked.seconds ? Math.round(asked.seconds * doc.fps) : undefined;
  const same = (!size || (size.width === doc.width && size.height === doc.height)) && (!durationInFrames || durationInFrames === doc.durationInFrames);
  if (same) {
    return null;
  }
  const sized = setCanvas(doc, { format: asked.format, durationInFrames });
  return sized.ok ? sized.doc : null;
}
