import type { ComponentId } from './components';
import type { MotionDoc } from './doc';
import { SmallText, type ReferenceLook } from './reference-look-model';

export enum LookMiss {
  Unrecorded = 'look-unrecorded',
  TypeScale = 'look-type-scale',
  TypeScaleGross = 'look-type-scale-gross',
  Bleed = 'look-bleed',
  Columns = 'look-columns',
  NoSmallText = 'look-no-small-text'
}

export type LookProblem = { miss: LookMiss; detail: string };

type Clip = MotionDoc['tracks'][number]['clips'][number];

const TEXTS: ReadonlySet<ComponentId> = new Set(['Title', 'Text', 'Kicker', 'Caption'] as ComponentId[]);
const SHORT = 0.75;
const GROSS = 0.5;
const SMALL_TYPE = 0.045;
const GLYPH_WIDTH = 0.55;
const SMALL_BLOCKS: Record<SmallText, number> = { [SmallText.None]: 0, [SmallText.Some]: 1, [SmallText.Dense]: 3 };

const num = (clip: Clip, key: string, fallback: number) => {
  const v = (clip.props as Record<string, unknown>)[key];
  return typeof v === 'number' ? v : fallback;
};

const round = (n: number) => Math.round(n * 100) / 100;

function peakScale(clip: Clip): number {
  const keyed = (clip.keyframes.scale ?? []).map((k) => Number(k.value)).filter(Number.isFinite);
  return num(clip, 'scale', 1) * Math.max(clip.transform?.scale ?? 1, ...keyed);
}

const typeSize = (clip: Clip) => num(clip, 'size', 0.1) * peakScale(clip);

function runsOffEdge(clip: Clip, doc: MotionDoc): boolean {
  const longest = Math.max(...String(clip.props.text ?? '').split('\n').map((l) => l.length));
  const glyphs = (longest * num(clip, 'size', 0.1) * doc.height * GLYPH_WIDTH) / doc.width;
  const halfW = (Math.max(num(clip, 'width', 0.8), glyphs) * peakScale(clip)) / 2;
  const halfH = (num(clip, 'height', 0.4) * peakScale(clip)) / 2;
  const x = num(clip, 'x', 0.5);
  const y = num(clip, 'y', 0.5);
  return x - halfW < 0 || x + halfW > 1 || y - halfH < 0 || y + halfH > 1;
}

const bleeds = (clip: Clip, doc: MotionDoc) => clip.bleed === true || (TEXTS.has(clip.component) && runsOffEdge(clip, doc));

function typeScale(texts: readonly Clip[], look: ReferenceLook): LookProblem[] {
  const largest = Math.max(0, ...texts.map(typeSize));
  if (largest >= look.typeScale * SHORT) {
    return [];
  }
  const miss = largest < look.typeScale * GROSS ? LookMiss.TypeScaleGross : LookMiss.TypeScale;
  return [{ miss, detail: `the references set the largest type at ${look.typeScale} of the frame height, the largest here is ${round(largest)}: raise the size of the main word (a scale keyframe counts) until it fills the frame as in the references` }];
}

function bleed(clips: readonly Clip[], doc: MotionDoc, look: ReferenceLook): LookProblem[] {
  if (!look.bleed || clips.some((c) => bleeds(c, doc))) {
    return [];
  }
  return [{ miss: LookMiss.Bleed, detail: 'the references run type off the frame edge and nothing here does: push the giant word partly outside one or two edges (x or y near the edge, a size wider than the frame) and declare it with set_visibility bleed true' }];
}

function columns(texts: readonly Clip[], look: ReferenceLook): LookProblem[] {
  const needed = look.smallText === SmallText.None ? 0 : Math.max(look.columns, SMALL_BLOCKS[look.smallText]);
  const blocks = texts.filter((c) => num(c, 'size', 0.1) <= SMALL_TYPE).length;
  if (blocks >= needed) {
    return [];
  }
  const miss = blocks === 0 ? LookMiss.NoSmallText : LookMiss.Columns;
  return [{ miss, detail: `the references set ${look.columns} columns with ${look.smallText} small text, the video has ${blocks} small-text block(s) (size at most ${SMALL_TYPE}): add short columns of small text (dates, places, numbers, a few words per line) hung on the grid, at least ${needed}` }];
}

export function lookProblems(doc: MotionDoc, clips: readonly Clip[], referencesSeen: boolean): LookProblem[] {
  const look = doc.referenceLook;
  if (!look) {
    return referencesSeen ? [{ miss: LookMiss.Unrecorded, detail: 'you looked at references but recorded no look: call set_reference_look with what they measure (largest type as a share of the frame height, bleed, columns, small text, palette, font class, imagery), then build to it' }] : [];
  }
  const texts = clips.filter((c) => TEXTS.has(c.component));
  return [...typeScale(texts, look), ...bleed(clips, doc, look), ...columns(texts, look)];
}
