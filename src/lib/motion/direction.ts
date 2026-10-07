import { COMPONENTS, TrackKind, type ComponentId } from './components';
import type { MotionDoc } from './doc';
import { DEVICE, Device } from './devices';
import { styleProblems } from './style';
import { UI_KIT, UI_SAFE, uiScale } from './ui-kit/kit';
import { sampleTrack } from './sample-track';
import { FillKind, ShapeKind } from './shape/schema';

export enum Quality {
  RepeatedLayout = 'repeated-layout',
  SmallTitle = 'small-title',
  Silent = 'silent',
  BlankFrame = 'blank-frame',
  WhiteArea = 'white-area',
  OffStyle = 'off-style',
  SoftPicture = 'soft-picture',
  CroppedScreen = 'cropped-screen',
  BrandLogoAltered = 'brand-logo-altered',
  OutOfFrame = 'out-of-frame',
  CutMidAnimation = 'cut-mid-animation',
  BackgroundSeam = 'background-seam'
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

const LOGO_ENTRANCE: ReadonlySet<string> = new Set(['opacity', 'scale', 'x', 'y']);
const EXTRUDED: ReadonlySet<ComponentId> = new Set(['Logo3D'] as ComponentId[]);
const FLAT_LOGO: ReadonlySet<ComponentId> = new Set(['Logo', 'Image'] as ComponentId[]);

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
  const peak = (key: string, base: number) => Math.max(base, ...(clip.keyframes[key] ?? []).map((k) => Number(k.value)).filter(Number.isFinite));
  return num(clip, 'scale', 1) * peak('scale', clip.transform?.scale ?? 1) * peak('zoom', num(clip, 'zoom', 1));
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

const ALTERATIONS: { name: string; applies: (clip: Clip) => boolean }[] = [
  { name: 'extruded in 3D', applies: (clip) => EXTRUDED.has(clip.component) },
  { name: 'filtered', applies: (clip) => clip.effects.some((e) => e.enabled) },
  { name: 'blended', applies: (clip) => clip.blend !== 'normal' },
  { name: 'masked', applies: (clip) => Boolean(clip.mask) || clip.maskStack.length > 0 || clip.matte !== 'none' },
  { name: 'deformed or turned', applies: (clip) => Object.keys(clip.keyframes).some((k) => !LOGO_ENTRANCE.has(k)) || Object.keys(clip.transform ?? {}).some((k) => !LOGO_ENTRANCE.has(k) && k !== 'anchorX' && k !== 'anchorY') }
];

const showsLogo = (clip: Clip, logos: ReadonlySet<string>) => (FLAT_LOGO.has(clip.component) || EXTRUDED.has(clip.component)) && logos.has(String(clip.props.assetId ?? ''));

function alteredLogos(doc: MotionDoc, logos: ReadonlySet<string>): QualityProblem[] {
  return everyClip(doc).flatMap((clip) => {
    const found = showsLogo(clip, logos) ? ALTERATIONS.filter((a) => a.applies(clip)).map((a) => a.name) : [];
    return found.length ? [{ kind: Quality.BrandLogoAltered, at: seconds(doc, clip.from), detail: `${clip.id} shows the real brand logo ${found.join(', ')}: a brand logo stays the original asset, flat and intact (Logo or Image), entering with a fade or a small scale only` }] : [];
  });
}

const OUT_FRAMES_ALLOWED = 6;
const EDGE_SECONDS = 0.35;
const GLYPH_WIDTH = 0.55;
const LINE_HEIGHT = 1.1;
const TEXTS: ReadonlySet<ComponentId> = new Set(['Title', 'Text', 'Kicker', 'Caption'] as ComponentId[]);
const PIECES = new Map(Object.values(UI_KIT).map((p) => [p.name, p]));

type Size = { width: number; height: number };

function textSize(clip: Clip, frame: Size): Size {
  const lines = String(clip.props.text ?? '').split('\n');
  const px = num(clip, 'size', 0.1) * frame.height;
  const longest = Math.max(...lines.map((l) => l.length));
  return { width: Math.min(num(clip, 'width', 0.8) * frame.width, longest * px * GLYPH_WIDTH), height: Math.min(num(clip, 'height', 0.4) * frame.height, lines.length * px * LINE_HEIGHT) };
}

function contentSize(clip: Clip, frame: Size): Size | null {
  const piece = clip.component === 'Custom' ? PIECES.get(String(clip.props.name)) : undefined;
  if (piece) {
    const scale = uiScale(piece, frame, num(clip, 'zoom', 1));
    return { width: piece.size.width * scale, height: piece.size.height * scale };
  }
  return TEXTS.has(clip.component) ? textSize(clip, frame) : null;
}

const at = (clip: Clip, key: string, frame: number, fallback: number) => {
  const track = clip.keyframes[key];
  return track?.length ? Number(sampleTrack(track as never, frame)) : ((clip.transform as Record<string, number> | undefined)?.[key] ?? fallback);
};

function outside(clip: Clip, size: Size, frame: Size, f: number): boolean {
  const scale = at(clip, 'scale', f, 1);
  const cx = (num(clip, 'x', 0.5) + at(clip, 'x', f, 0)) * frame.width;
  const cy = (num(clip, 'y', 0.5) + at(clip, 'y', f, 0)) * frame.height;
  const halfW = (size.width * scale) / 2;
  const halfH = (size.height * scale) / 2;
  const margin = (1 - UI_SAFE) / 2;
  return cx - halfW < frame.width * margin - 1 || cx + halfW > frame.width * (1 - margin) + 1 || cy - halfH < frame.height * margin - 1 || cy + halfH > frame.height * (1 - margin) + 1;
}

function outOfFrame(doc: MotionDoc): QualityProblem[] {
  const frame = { width: doc.width, height: doc.height };
  const edge = Math.round(EDGE_SECONDS * doc.fps);
  return doc.tracks.flatMap((t) => t.clips as Clip[]).flatMap((clip) => {
    const size = contentSize(clip, frame);
    if (!size) {
      return [];
    }
    const frames = Array.from({ length: Math.max(0, clip.durationInFrames - 2 * edge) }, (_, i) => i + edge);
    const out = frames.filter((f) => outside(clip, size, frame, f));
    if (out.length <= OUT_FRAMES_ALLOWED) {
      return [];
    }
    return [{ kind: Quality.OutOfFrame, at: seconds(doc, clip.from + out[0]), detail: `${clip.id} leaves the safe area (5% from each edge) for ${out.length} frames from ${seconds(doc, clip.from + out[0])}s: keep scale moves small and slow, move the camera or the position instead, or shrink it (zoom, width)` }];
  });
}

const HOLD_S = 1;
const DRIFT_S = 2;

function unsettledPiece(doc: MotionDoc, clip: Clip): number | null {
  const piece = clip.component === 'Custom' ? PIECES.get(String(clip.props.name)) : undefined;
  if (!piece) {
    return null;
  }
  const length = clip.durationInFrames / doc.fps;
  const settled = piece.settles(clip.props, length);
  return settled + HOLD_S > length ? settled : null;
}

function unsettledKeys(doc: MotionDoc, clip: Clip): number | null {
  const cutoff = clip.durationInFrames - HOLD_S * doc.fps;
  const ends = Object.values(clip.keyframes).flatMap((track) =>
    (track ?? []).slice(1).flatMap((k, i) => {
      const prev = track[i];
      const moving = Number(k.value) !== Number(prev.value);
      const drift = k.frame - prev.frame >= DRIFT_S * doc.fps;
      return moving && !drift && prev.frame < cutoff && k.frame > cutoff ? [k.frame / doc.fps] : [];
    })
  );
  return ends.length ? Math.max(...ends) : null;
}

function cutsMidAnimation(doc: MotionDoc): QualityProblem[] {
  return doc.tracks.flatMap((t) => t.clips as Clip[]).flatMap((clip) => {
    const settled = unsettledPiece(doc, clip) ?? unsettledKeys(doc, clip);
    if (settled === null) {
      return [];
    }
    const need = round(settled + HOLD_S);
    return [{ kind: Quality.CutMidAnimation, at: seconds(doc, clip.from + clip.durationInFrames), detail: `${clip.id} is cut at ${seconds(doc, clip.from + clip.durationInFrames)}s while it still animates (it settles ${round(settled)}s in): give it at least ${need}s so the last state holds ${HOLD_S}s before the cut` }];
  });
}

const BACKDROP_AREA = 0.5;
const GRADIENTS: ReadonlySet<string> = new Set([FillKind.Linear, FillKind.Radial]);
const CORNERS = [[0, 0], [1, 0], [0, 1], [1, 1]];

type Box = { x: number; y: number; w: number; h: number };

const COVERS: Partial<Record<ShapeKind, (b: Box) => boolean>> = {
  [ShapeKind.Ellipse]: (b) => CORNERS.every(([cx, cy]) => ((cx - b.x) / (b.w / 2)) ** 2 + ((cy - b.y) / (b.h / 2)) ** 2 <= 1),
  [ShapeKind.Circle]: (b) => CORNERS.every(([cx, cy]) => ((cx - b.x) / (b.w / 2)) ** 2 + ((cy - b.y) / (b.h / 2)) ** 2 <= 1)
};

const boxCovers = (b: Box) => b.x - b.w / 2 <= 0 && b.x + b.w / 2 >= 1 && b.y - b.h / 2 <= 0 && b.y + b.h / 2 >= 1;

function backgroundSeams(doc: MotionDoc): QualityProblem[] {
  return doc.tracks.flatMap((t) => t.clips as Clip[]).flatMap((clip) => {
    if (clip.component !== 'Shape' || !GRADIENTS.has(String(clip.props.fillKind))) {
      return [];
    }
    const scale = at(clip, 'scale', clip.durationInFrames - 1, 1);
    const box = { x: num(clip, 'x', 0.5), y: num(clip, 'y', 0.5), w: num(clip, 'width', 0) * scale, h: num(clip, 'height', 0) * scale };
    if (box.w * box.h < BACKDROP_AREA) {
      return [];
    }
    const covers = COVERS[clip.props.shape as ShapeKind] ?? boxCovers;
    if (covers(box)) {
      return [];
    }
    return [{ kind: Quality.BackgroundSeam, at: seconds(doc, clip.from), detail: `${clip.id} is a background gradient that stops inside the frame: its edge shows as a seam. Make it cover the whole frame (a rect at least as large as the frame, an ellipse large enough to clear the corners) or use a flat colour` }];
  });
}

export function docProblems(doc: MotionDoc, input: { audioAssets: number; pixels?: Pixels; logos?: readonly string[] }): QualityProblem[] {
  const list = scenes(doc);
  const pixels = input.pixels ?? {};
  return [...repeated(doc, list), ...smallTitles(doc), ...silent(doc, input.audioAssets), ...softPictures(doc, pixels), ...croppedScreens(doc, pixels), ...alteredLogos(doc, new Set(input.logos ?? [])), ...outOfFrame(doc), ...cutsMidAnimation(doc), ...backgroundSeams(doc), ...styleProblems(doc).map((p) => ({ kind: Quality.OffStyle, at: p.at, detail: p.detail }))];
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
