import { compOf, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { CLIP_LEVEL_OVERRIDES } from '@feega/motion-core/motion/precomp';
import type { Overrides } from '$lib/motion/main-component';
import { nestedOverrides, pathTo, type PathChange } from '$lib/motion/nested-overrides';
import type { FigmaImage } from './figma-doc';

type Pair = { own: MotionClip; main: MotionClip; top: boolean };
type Slot = Omit<FigmaImage, 'clipId'>;
export type InstanceDiff = { overrides: Overrides; images: Slot[] };
export type ImagesOf = { own: FigmaImage[]; main: FigmaImage[] };

const IGNORED = new Set(['id', 'name', 'parent', 'matteFrom', 'props', 'source', ...CLIP_LEVEL_OVERRIDES]);

const PRECISION = 1e6;

const rounded = (_key: string, value: unknown) => (typeof value === 'number' ? Math.round(value * PRECISION) / PRECISION : value);

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null, rounded) === JSON.stringify(b ?? null, rounded);

const clipsOf = (doc: MotionDoc, compId: string): MotionClip[][] => (doc.comps[compId]?.tracks ?? []).map((t) => t.clips as MotionClip[]);

function paired(doc: MotionDoc, ownId: string, mainId: string, top: boolean): Pair[] | null {
  const [own, main] = [clipsOf(doc, ownId), clipsOf(doc, mainId)];
  if (own.length !== main.length || own.some((clips, i) => clips.length !== main[i].length)) {
    return null;
  }
  const pairs: Pair[] = [];
  for (const [i, clips] of own.entries()) {
    for (const [j, clip] of clips.entries()) {
      const other = main[i][j];
      const nested = [compOf(clip), compOf(other)];
      const inner = nested[0] && nested[1] ? paired(doc, nested[0], nested[1], false) : nested[0] || nested[1] ? null : [];
      if (clip.component !== other.component || !inner) {
        return null;
      }
      pairs.push({ own: clip, main: other, top }, ...inner);
    }
  }
  return pairs;
}

const shownOf = ({ clipId: _clip, innerId: _inner, at: _at, ...look }: Partial<FigmaImage> = {}) => look;

const restOf = (clip: MotionClip) => Object.fromEntries(Object.entries(clip).filter(([k]) => !IGNORED.has(k)));

function changed(pair: Pair): Record<string, unknown> {
  const { own, main } = pair;
  const keys = new Set([...Object.keys(own.props), ...Object.keys(main.props)].filter((k) => k !== 'comp'));
  const props = [...keys].filter((k) => !same(own.props[k], main.props[k])).map((k) => [k, own.props[k]] as const);
  const level = CLIP_LEVEL_OVERRIDES.filter((k) => !same(own[k], main[k])).map((k) => [k, own[k]] as const);
  return Object.fromEntries([...props, ...level]);
}

export function instanceOverrides(doc: MotionDoc, ownId: string, mainId: string, images: ImagesOf): InstanceDiff | null {
  const pairs = paired(doc, ownId, mainId, true);
  if (!pairs) {
    return null;
  }
  const mainOf = new Map(pairs.map((p) => [p.own.id, p]));
  const linked = (own: string | null | undefined, main: string | null | undefined) => (own ? mainOf.get(own)?.main.id === main : !main);
  const parentsMatch = pairs.every((p) => linked(p.own.parent, p.main.parent) && linked(p.own.matteFrom, p.main.matteFrom));
  if (!parentsMatch || pairs.some((p) => !same(restOf(p.own), restOf(p.main)))) {
    return null;
  }

  const overrides: Overrides = {};
  const nested: PathChange[] = [];
  for (const pair of pairs) {
    const diff = changed(pair);
    if (!Object.keys(diff).length) {
      continue;
    }
    if (pair.top) {
      overrides[pair.main.id] = diff;
      continue;
    }
    nested.push({ path: pathTo(doc, mainId, pair.main.id)!, props: diff });
  }
  const deep = nestedOverrides(doc, mainId, nested);
  for (const [id, props] of Object.entries(deep)) {
    overrides[id] = { ...overrides[id], ...props };
  }

  const slot = (list: FigmaImage[], clipId: string, at: number) => list.find((i) => i.clipId === clipId && i.at === at);
  const slots: Slot[] = [];
  for (const image of images.own) {
    const pair = mainOf.get(image.clipId);
    if (!pair) {
      return null;
    }
    if (same(shownOf(image), shownOf(slot(images.main, pair.main.id, image.at)))) {
      continue;
    }
    if (!pair.top) {
      return null;
    }
    const { clipId: _clip, ...look } = image;
    slots.push({ ...look, innerId: pair.main.id });
  }
  const covered = images.main.every((m) => pairs.some((p) => p.main.id === m.clipId && slot(images.own, p.own.id, m.at)));
  return covered ? { overrides, images: slots } : null;
}
