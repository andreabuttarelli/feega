import { COMPONENTS, TrackKind, type ComponentId } from './components';
import { TransitionKind } from './design';
import type { MotionDoc } from './doc';

export enum Quality {
  RepeatedLayout = 'repeated-layout',
  HardCuts = 'hard-cuts',
  SmallTitle = 'small-title',
  Silent = 'silent',
  BlankFrame = 'blank-frame',
  WhiteArea = 'white-area'
}

export type QualityProblem = { kind: Quality; at?: number; detail: string };

export type FrameStat = { time: number; lumaStd: number; whiteShare: number };

export const DIRECTION_RULES: readonly string[] = [
  'Storyboard first: before the first edit, write the plan as a short table, one row per scene: time, layout, what moves, the transition into it, the beat it lands on.',
  'Never the same layout twice in a row: alternate full-bleed title, split (text one side, media the other, swap sides), centred hero media, grid or row of devices, big number, end card.',
  'Every scene change is a real transition: set_clip_transition (push, wipe, zoom, whip…) or a camera move across the cut, never a bare cut between every scene.',
  'Type hierarchy: one hero line per scene, its box at least half the frame wide; kicker and captions small. The hook title fills the frame.',
  'Screenshots must be readable: crop or zoom on the part that matters (set_transform scale, a mask, or a camera dolly-in), never a whole page shrunk into a device.',
  'No empty frames: a device or image is on screen with its picture from its first frame; never let a screen enter white or blank.',
  'Sound: when the project has music, put it on an Audio clip and cut to its beats (analyze_audio, cut_to_beat).'
];

const SCENE_JOIN_S = 0.5;
const SCENE_SHARE = 0.9;
const MIN_TITLE_AREA = 0.12;
const HARD_CUT_SHARE = 0.5;
const BLANK_STD = 4;
const WHITE_SHARE = 0.15;
const LEFT = 0.4;
const RIGHT = 0.6;

const BACKDROPS: ReadonlySet<ComponentId> = new Set(['BrandBackground', 'Adjustment', 'Particles', 'Null'] as ComponentId[]);
const MEDIA: ReadonlySet<ComponentId> = new Set(['Image', 'Video', 'Device3D', 'Model3D'] as ComponentId[]);

type Clip = MotionDoc['tracks'][number]['clips'][number];

const num = (clip: Clip, key: string, fallback: number) => {
  const v = (clip.props as Record<string, unknown>)[key];
  return typeof v === 'number' ? v : fallback;
};

const side = (x: number) => (x < LEFT ? 'L' : x > RIGHT ? 'R' : 'C');

const role = (clip: Clip) => (MEDIA.has(clip.component) ? 'media' : clip.component);

function scenes(doc: MotionDoc): Clip[][] {
  const join = SCENE_JOIN_S * doc.fps;
  const clips = doc.tracks
    .filter((t) => t.kind === TrackKind.Visual)
    .flatMap((t) => t.clips)
    .filter((c) => COMPONENTS[c.component].track === TrackKind.Visual && !BACKDROPS.has(c.component) && c.durationInFrames < doc.durationInFrames * SCENE_SHARE)
    .sort((a, b) => a.from - b.from);

  const grouped: Clip[][] = [];
  for (const clip of clips) {
    const current = grouped.at(-1);
    if (current && clip.from - current[0].from <= join) {
      current.push(clip);
      continue;
    }
    grouped.push([clip]);
  }
  return grouped;
}

const layoutOf = (scene: Clip[]) => scene.map((c) => `${role(c)}@${side(num(c, 'x', 0.5))}`).sort().join(' ');

const enters = (scene: Clip[]) => scene.some((c) => c.transitionIn.kind !== TransitionKind.None || c.junction);

const seconds = (doc: MotionDoc, frame: number) => Math.round((frame / doc.fps) * 100) / 100;

function repeated(doc: MotionDoc, list: Clip[][]): QualityProblem[] {
  return list.slice(1).flatMap((scene, i) =>
    layoutOf(scene) === layoutOf(list[i]) ? [{ kind: Quality.RepeatedLayout, at: seconds(doc, scene[0].from), detail: `the scene at ${seconds(doc, scene[0].from)}s repeats the layout of the one before (${layoutOf(scene)})` }] : []
  );
}

function hardCuts(list: Clip[][]): QualityProblem[] {
  const cuts = list.slice(1);
  const bare = cuts.filter((scene) => !enters(scene)).length;
  return cuts.length && bare / cuts.length > HARD_CUT_SHARE ? [{ kind: Quality.HardCuts, detail: `${bare} of ${cuts.length} scene changes are bare cuts: give them set_clip_transition or a camera move` }] : [];
}

function smallTitles(doc: MotionDoc): QualityProblem[] {
  return doc.tracks
    .flatMap((t) => t.clips)
    .filter((c) => c.component === 'Title' && num(c, 'width', 0.8) * num(c, 'height', 0.4) < MIN_TITLE_AREA)
    .map((c) => ({ kind: Quality.SmallTitle, at: seconds(doc, c.from), detail: `title ${c.id} at ${seconds(doc, c.from)}s sits in a small box (${Math.round(num(c, 'width', 0.8) * 100)}% × ${Math.round(num(c, 'height', 0.4) * 100)}% of the frame): it reads small` }));
}

function silent(doc: MotionDoc, audioAssets: number): QualityProblem[] {
  const plays = doc.tracks.some((t) => t.kind === TrackKind.Audio && t.clips.length > 0);
  return audioAssets > 0 && !plays ? [{ kind: Quality.Silent, detail: 'the project has music the video never plays' }] : [];
}

export function docProblems(doc: MotionDoc, input: { audioAssets: number }): QualityProblem[] {
  const list = scenes(doc);
  return [...repeated(doc, list), ...hardCuts(list), ...smallTitles(doc), ...silent(doc, input.audioAssets)];
}

export function frameProblems(stats: readonly FrameStat[]): QualityProblem[] {
  return stats.flatMap((s) => {
    if (s.lumaStd < BLANK_STD) {
      return [{ kind: Quality.BlankFrame, at: s.time, detail: `the frame at ${s.time}s is a flat colour: nothing is on screen` }];
    }
    if (s.whiteShare > WHITE_SHARE) {
      return [{ kind: Quality.WhiteArea, at: s.time, detail: `${Math.round(s.whiteShare * 100)}% of the frame at ${s.time}s is plain white: a screen or picture that has not loaded?` }];
    }
    return [];
  });
}
