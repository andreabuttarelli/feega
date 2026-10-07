import { COMPONENTS, TrackKind, type ComponentId } from './components';
import type { MotionDoc } from './doc';
import { DEVICE, Device } from './devices';
import { styleProblems } from './style';

export enum Quality {
  RepeatedLayout = 'repeated-layout',
  SmallTitle = 'small-title',
  Silent = 'silent',
  BlankFrame = 'blank-frame',
  WhiteArea = 'white-area',
  OffStyle = 'off-style',
  SoftPicture = 'soft-picture',
  CroppedScreen = 'cropped-screen'
}

export type Pixels = Record<string, { width: number; height: number }>;

export type QualityProblem = { kind: Quality; at?: number; detail: string };

export type FrameStat = { time: number; lumaStd: number; whiteShare: number };

const SCENE_JOIN_S = 0.5;
const SCENE_SHARE = 0.9;
const MIN_TITLE_AREA = 0.12;
const BLANK_STD = 4;
const WHITE_SHARE = 0.15;
const SOFT_UPSCALE = 1.25;
const SIDES_KEPT = 0.75;
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

const templateOf = (doc: MotionDoc, clip: Clip) => doc.comps[String(clip.props.comp)]?.template?.id;

const role = (doc: MotionDoc, clip: Clip) => (MEDIA.has(clip.component) ? 'media' : (templateOf(doc, clip) ?? clip.component));

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

const layoutOf = (doc: MotionDoc, scene: Clip[]) => scene.map((c) => `${role(doc, c)}@${side(num(c, 'x', 0.5))}`).sort().join(' ');


const seconds = (doc: MotionDoc, frame: number) => Math.round((frame / doc.fps) * 100) / 100;

function repeated(doc: MotionDoc, list: Clip[][]): QualityProblem[] {
  return list.slice(1).flatMap((scene, i) =>
    layoutOf(doc, scene) === layoutOf(doc, list[i]) ? [{ kind: Quality.RepeatedLayout, at: seconds(doc, scene[0].from), detail: `the scene at ${seconds(doc, scene[0].from)}s repeats the layout of the one before (${layoutOf(doc, scene)})` }] : []
  );
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

const everyClip = (doc: MotionDoc) => [doc.tracks, ...Object.values(doc.comps).map((c) => c.tracks)].flatMap((tracks) => tracks.flatMap((t) => t.clips as Clip[]));

const round = (n: number) => Math.round(n * 100) / 100;

function largestZoom(clip: Clip): number {
  const keyed = (clip.keyframes.scale ?? []).map((k) => Number(k.value)).filter(Number.isFinite);
  return Math.max(clip.transform?.scale ?? 1, ...keyed);
}

function softPictures(doc: MotionDoc, pixels: Pixels): QualityProblem[] {
  return everyClip(doc).flatMap((clip) => {
    const source = clip.component === 'Image' ? pixels[String(clip.props.assetId)] : undefined;
    if (!source) {
      return [];
    }
    const box = { width: num(clip, 'width', 1) * doc.width, height: num(clip, 'height', 1) * doc.height };
    const fits = [box.width / source.width, box.height / source.height];
    const fitted = clip.props.fit === 'contain' ? Math.min(...fits) : Math.max(...fits);
    const shown = fitted * largestZoom(clip);
    if (shown <= SOFT_UPSCALE) {
      return [];
    }
    return [{ kind: Quality.SoftPicture, at: seconds(doc, clip.from), detail: `${clip.id} blows a ${source.width}×${source.height} picture up ${round(shown)}×: it reads soft. Its largest sharp scale is ${round(1 / fitted)} (source pixels / pixels on screen): use a sharper picture (import_asset with capture) or show it smaller` }];
  });
}

function croppedScreens(doc: MotionDoc, pixels: Pixels): QualityProblem[] {
  return everyClip(doc).flatMap((clip) => {
    const source = clip.component === 'Device3D' ? pixels[String(clip.props.screen)] : undefined;
    const device = DEVICE[(clip.props.device as Device) ?? Device.PhonePro];
    if (!source || !device) {
      return [];
    }
    const [w, h] = device.screen.px;
    const kept = w / h / (source.width / source.height);
    if (kept >= SIDES_KEPT) {
      return [];
    }
    return [{ kind: Quality.CroppedScreen, at: seconds(doc, clip.from), detail: `${clip.id} shows a ${source.width}×${source.height} picture on a ${w}×${h} screen: ${Math.round((1 - kept) * 100)}% of its width is cut off. Use a capture that matches the screen (mobile for a phone, desktop for a laptop)` }];
  });
}

export function docProblems(doc: MotionDoc, input: { audioAssets: number; pixels?: Pixels }): QualityProblem[] {
  const list = scenes(doc);
  const pixels = input.pixels ?? {};
  return [...repeated(doc, list), ...smallTitles(doc), ...silent(doc, input.audioAssets), ...softPictures(doc, pixels), ...croppedScreens(doc, pixels), ...styleProblems(doc).map((p) => ({ kind: Quality.OffStyle, at: p.at, detail: p.detail }))];
}

export function frameProblems(stats: readonly FrameStat[]): QualityProblem[] {
  return stats.flatMap((s): QualityProblem[] => {
    if (s.lumaStd < BLANK_STD) {
      return [{ kind: Quality.BlankFrame, at: s.time, detail: `the frame at ${s.time}s is a flat colour: nothing is on screen` }];
    }
    if (s.whiteShare > WHITE_SHARE) {
      return [{ kind: Quality.WhiteArea, at: s.time, detail: `${Math.round(s.whiteShare * 100)}% of the frame at ${s.time}s is plain white: a screen or picture that has not loaded?` }];
    }
    return [];
  });
}
