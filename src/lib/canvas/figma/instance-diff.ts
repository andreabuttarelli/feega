import { compOf, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { CLIP_LEVEL_OVERRIDES } from '@feega/motion-core/motion/precomp';
import type { Overrides } from '$lib/motion/main-component';
import { nestedOverrides, pathTo, type PathChange } from '$lib/motion/nested-overrides';
import type { FigmaImage } from './figma-doc';

type Pair = { own: MotionClip; main: MotionClip; top: boolean };
type Slot = Omit<FigmaImage, 'clipId'>;
export type InstanceDiff = { overrides: Overrides; images: Slot[] };
export type ImagesOf = { own: FigmaImage[]; main: FigmaImage[] };

const IGNORED = new Set(['id', 'name', 'parent', 'props', ...CLIP_LEVEL_OVERRIDES]);

const PRECISION = 1e6;
const GEOMETRY = new Set(['x', 'y', 'width', 'height', 'path', 'transform']);
const NESTED = new Set(['text', 'overrides']);

const reflows = (clip: MotionClip) => Boolean(clip.autoLayout) || clip.component === 'Text';

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
  const parentsMatch = pairs.every((p) => (p.own.parent ? mainOf.get(p.own.parent)?.main.id === p.main.parent : !p.main.parent));
  if (!parentsMatch || pairs.some((p) => !same(restOf(p.own), restOf(p.main)))) {
    return null;
  }

  const laidOut = pairs.some((p) => p.main.autoLayout);
  const overrides: Overrides = {};
  const nested: PathChange[] = [];
  for (const pair of pairs) {
    const diff = changed(pair);
    const keys = Object.keys(diff);
    if (!keys.length) {
      continue;
    }
    const path = pair.top ? null : pathTo(doc, mainId, pair.main.id);
    if (path && keys.every((k) => NESTED.has(k) || (pair.main.component === 'Text' && GEOMETRY.has(k)))) {
      nested.push({ path, props: diff });
      continue;
    }
    if (!pair.top || (laidOut && !reflows(pair.main) && keys.some((k) => GEOMETRY.has(k)))) {
      return null;
    }
    overrides[pair.main.id] = diff;
  }
  const deep = nestedOverrides(doc, mainId, nested);
  for (const [id, props] of Object.entries(deep)) {
    overrides[id] = { ...overrides[id], ...props };
  }

  const slot = (list: FigmaImage[], clipId: string, at: number) => list.find((i) => i.clipId === clipId && i.at === at)?.hash;
  const slots: Slot[] = [];
  for (const image of images.own) {
    const pair = mainOf.get(image.clipId);
    if (!pair) {
      return null;
    }
    if (slot(images.main, pair.main.id, image.at) === image.hash) {
      continue;
    }
    if (!pair.top || 1) {
      return null;
    }
    slots.push({ innerId: pair.main.id, hash: image.hash, at: image.at });
  }
  const covered = images.main.every((m) => pairs.some((p) => p.main.id === m.clipId && slot(images.own, p.own.id, m.at)));
  return covered ? { overrides, images: slots } : null;
}
