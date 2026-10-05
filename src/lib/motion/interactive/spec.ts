import { clipsOf, type MotionClip, type MotionDoc } from '../doc';
import { TRANSFORM, TRANSFORM_KEYS } from '../keyframes';
import { docBook } from '../expression/bake';
import type { LaneData } from '../expression/evaluator';
import { readsInput } from '../expression/inputs';
import { liveTarget } from '../hyperframes/animate';
import { hostIdsOf } from '../comp-path';
import { pivotOf } from '../parent';
import { HOST_KEYS, type HostSpec, type LiveLane, type LiveSpec } from './live';
import type { Outside } from './settings';

const READS_AUDIO = /\baudio\s*\./;

const isLiveSource = (source: string) => readsInput(source) && !READS_AUDIO.test(source);

export function liveLanes(doc: MotionDoc, parents: ReadonlySet<string> = new Set()): LiveLane[] {
  return clipsOf(doc).flatMap((c) =>
    Object.entries(c.expressions).flatMap(([key, source]) => {
      const target = isLiveSource(source) ? liveTarget(c, key, parents) : null;
      return target ? [{ id: c.id, key, ...target }] : [];
    })
  );
}

function lanesOf(doc: MotionDoc, live: MotionDoc, lanes: LiveLane[]): LaneData[] {
  const book = docBook(doc);
  const liveBook = docBook(live);
  const isLive = new Set(lanes.map((l) => `${l.id}.${l.key}`));
  return clipsOf(doc).flatMap((c) =>
    [...new Set([...TRANSFORM_KEYS, ...Object.keys(c.keyframes), ...Object.keys(live.tracks.flatMap((t) => t.clips).find((l) => l.id === c.id)?.expressions ?? {})])].flatMap((key) => {
      try {
        return [isLive.has(`${c.id}.${key}`) ? liveBook.lane(c.id, key) : book.lane(c.id, key)];
      } catch {
        return [];
      }
    })
  );
}

function hostOf(clip: MotionClip, doc: MotionDoc): HostSpec {
  return {
    pivot: pivotOf(clip, doc),
    tracks: Object.fromEntries(HOST_KEYS.map((key) => [key, { track: clip.keyframes[key] ?? [], base: clip.transform[key] ?? TRANSFORM[key].fallback }])) as HostSpec['tracks']
  };
}

function namesOf(doc: MotionDoc): Record<string, string> {
  const names: Record<string, string> = {};
  for (const c of clipsOf(doc)) {
    for (const name of [c.props.name, c.props.text]) {
      if (typeof name === 'string' && !(name in names)) {
        names[name] = c.id;
      }
    }
  }
  return names;
}

export type SpecInput = { live: MotionDoc; baked: MotionDoc; outside: Outside; parents: readonly string[] };

export function liveSpec(input: SpecInput): LiveSpec {
  const { live, baked } = input;
  const lanes = liveLanes(live, new Set(input.parents));
  const byId = new Map(clipsOf(baked).map((c) => [c.id, c]));
  const hostIds = [...new Set(lanes.flatMap((l) => hostIdsOf(l.id)))].filter((id) => byId.has(id));
  return {
    fps: live.fps,
    duration: live.durationInFrames / live.fps,
    width: live.width,
    height: live.height,
    outside: input.outside,
    live: lanes,
    lanes: lanesOf(baked, live, lanes),
    order: clipsOf(baked).map((c) => c.id),
    names: namesOf(baked),
    hosts: Object.fromEntries(hostIds.map((id) => [id, hostOf(byId.get(id)!, baked)]))
  };
}
