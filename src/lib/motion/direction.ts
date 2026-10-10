import { COMPONENTS, TrackKind, type ComponentId } from './components';
import { clipsOf, type MotionDoc } from './doc';
import { DEVICE, Device } from './devices';
import { Forbidden, STYLES, Script, styleOf, styleProblems } from './style';
import { MotionStyle } from './style-model';
import { UI_KIT, UI_SAFE, uiScale } from './ui-kit/kit';
import { sampleTrack } from './sample-track';
import { cursorClicks, cursorMisses, reelMisses, TARGET_SEPARATOR } from './clicks';
import { emptyContent, interactionOf, isUiPiece, Interaction, skeletons } from './ui-kit/content';
import { FillKind, ShapeKind } from './shape/schema';
import { CutFault, cutProblems } from './cuts';
import { scriptDrift } from './script-drift';
import { contentEnd, shownSpans, type Span } from './fit-duration';
import { liveComponents, liveNote } from './custom/determinism';
import { maskAt } from './ui-focus';
import { MaskKind } from './mask';
import { pivotBox } from './parent';
import { LookMiss, lookProblems } from './reference-look';
import { VECTOR_TOKEN } from './vector-ui/piece';
import { structureOf } from './ui-kit/anchors';
import { junctionProblem } from './junctions';

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
  TiltedText = 'tilted-text',
  EmptyFrames = 'empty-frames',
  TrailingEmpty = 'trailing-empty',
  SmallLogo = 'small-logo',
  ClickMiss = 'click-miss',
  EmptyUi = 'empty-ui',
  NoMicroMotion = 'no-micro-motion',
  NoScript = 'no-script',
  CutMidAnimation = 'cut-mid-animation',
  NoHold = 'no-hold',
  ScriptDrift = 'script-drift',
  BackgroundSeam = 'background-seam',
  LiveScene = 'live-scene',
  OffLook = 'off-look',
  NoProductUi = 'no-product-ui',
  DeadJunction = 'dead-junction'
}

export enum Severity {
  Warning = 'warning',
  Blocking = 'blocking'
}

export type Check = Quality | Forbidden | LookMiss;

export const SEVERITY: Record<Check, Severity> = {
  [Quality.RepeatedLayout]: Severity.Warning,
  [Quality.SmallTitle]: Severity.Warning,
  [Quality.Silent]: Severity.Blocking,
  [Quality.BlankFrame]: Severity.Blocking,
  [Quality.WhiteArea]: Severity.Blocking,
  [Quality.OffStyle]: Severity.Warning,
  [Quality.SoftPicture]: Severity.Blocking,
  [Quality.CroppedScreen]: Severity.Warning,
  [Quality.BrandLogoAltered]: Severity.Blocking,
  [Quality.OutOfFrame]: Severity.Warning,
  [Quality.TiltedText]: Severity.Warning,
  [Quality.EmptyFrames]: Severity.Blocking,
  [Quality.TrailingEmpty]: Severity.Blocking,
  [Quality.SmallLogo]: Severity.Warning,
  [Quality.ClickMiss]: Severity.Blocking,
  [Quality.EmptyUi]: Severity.Blocking,
  [Quality.NoMicroMotion]: Severity.Warning,
  [Quality.NoScript]: Severity.Warning,
  [Quality.CutMidAnimation]: Severity.Blocking,
  [Quality.NoHold]: Severity.Blocking,
  [Quality.ScriptDrift]: Severity.Blocking,
  [Quality.BackgroundSeam]: Severity.Warning,
  [Quality.LiveScene]: Severity.Warning,
  [Quality.OffLook]: Severity.Warning,
  [Quality.NoProductUi]: Severity.Blocking,
  [Quality.DeadJunction]: Severity.Blocking,
  [LookMiss.Unrecorded]: Severity.Blocking,
  [LookMiss.TypeScale]: Severity.Warning,
  [LookMiss.TypeScaleGross]: Severity.Blocking,
  [LookMiss.Bleed]: Severity.Blocking,
  [LookMiss.Columns]: Severity.Warning,
  [LookMiss.NoSmallText]: Severity.Blocking,
  [LookMiss.TypeFamily]: Severity.Blocking,
  [LookMiss.TypeFamilySmall]: Severity.Warning,
  [LookMiss.TypeWeight]: Severity.Warning,
  [LookMiss.TypeWeightGross]: Severity.Blocking,
  [LookMiss.TypeTracking]: Severity.Warning,
  [LookMiss.TypeLeading]: Severity.Warning,
  [LookMiss.TypeCase]: Severity.Warning,
  [LookMiss.TypeRoleMissing]: Severity.Warning,
  [LookMiss.Rules]: Severity.Warning,
  [Forbidden.Particles]: Severity.Warning,
  [Forbidden.Glow]: Severity.Warning,
  [Forbidden.Rotation]: Severity.Warning,
  [Forbidden.Bounce]: Severity.Warning,
  [Forbidden.FlyingText]: Severity.Warning,
  [Forbidden.Crowded]: Severity.Warning,
  [Forbidden.Transition]: Severity.Warning,
  [Forbidden.Still]: Severity.Warning,
  [Forbidden.OffBeat]: Severity.Warning,
  [Forbidden.NoPeak]: Severity.Warning,
  [Forbidden.RoughCut]: Severity.Warning,
  [Forbidden.ReadingTime]: Severity.Blocking,
  [Forbidden.Screenshots]: Severity.Blocking,
  [Forbidden.MissingStoryBeat]: Severity.Blocking,
  [Forbidden.Rushed]: Severity.Warning,
  [Forbidden.LoopSeam]: Severity.Blocking,
  [Forbidden.TooDense]: Severity.Warning,
  [Forbidden.WeakEase]: Severity.Warning,
  [Forbidden.TextOverScene]: Severity.Warning,
  [Forbidden.TooMuchText]: Severity.Warning,
  [Forbidden.UiOverload]: Severity.Warning,
  [Forbidden.TitleType]: Severity.Warning
};

export type Pixels = Record<string, { width: number; height: number }>;

export type QualityProblem = { kind: Quality; effect?: Forbidden | LookMiss; at?: number; detail: string };

export const severityOf = (p: QualityProblem) => SEVERITY[p.effect ?? p.kind];

export const blocking = (problems: readonly QualityProblem[]) => problems.filter((p) => severityOf(p) === Severity.Blocking);

export type FrameStat = { time: number; luma: number; lumaStd: number; whiteShare: number };

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

const SCORED: Record<MotionStyle, boolean> = { [MotionStyle.LaunchFilm]: true, [MotionStyle.AppleMinimal]: false, [MotionStyle.UiMorph]: true, [MotionStyle.Graphic]: false };

function silent(doc: MotionDoc, audioAssets: number): QualityProblem[] {
  const plays = doc.tracks.some((t) => t.kind === TrackKind.Audio && t.clips.length > 0);
  if (plays) {
    return [];
  }
  if (audioAssets > 0) {
    return [{ kind: Quality.Silent, detail: 'the project has music the video never plays' }];
  }
  return SCORED[styleOf(doc)] ? [{ kind: Quality.Silent, detail: 'the launch film has no music: add_music lays a track under it (pick mood and bpm), then cut on its beats' }] : [];
}

const everyClip = (doc: MotionDoc) => [doc.tracks, ...Object.values(doc.comps).map((c) => c.tracks)].flatMap((tracks) => tracks.flatMap((t) => t.clips as Clip[]));

const round = (n: number) => Math.round(n * 100) / 100;

function largestZoom(clip: Clip): number {
  const peak = (key: string, base: number) => Math.max(base, ...(clip.keyframes[key] ?? []).map((k) => Number(k.value)).filter(Number.isFinite));
  return num(clip, 'scale', 1) * peak('scale', clip.transform?.scale ?? 1) * peak('zoom', num(clip, 'zoom', 1));
}

export function softPictures(doc: MotionDoc, pixels: Pixels): QualityProblem[] {
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

type Shown = { dx: number; dy: number; width: number; height: number };

function shown(clip: Clip, size: Size, frame: Size, f: number): Shown {
  if (clip.mask?.kind !== MaskKind.Rect || clip.mask.invert) {
    return { dx: 0, dy: 0, ...size };
  }
  const box = pivotBox(clip.props, frame);
  const mx = (maskAt(clip, 'maskX', f) - 0.5) * box.width;
  const my = (maskAt(clip, 'maskY', f) - 0.5) * box.height;
  const halfW = (maskAt(clip, 'maskWidth', f) * box.width) / 2;
  const halfH = (maskAt(clip, 'maskHeight', f) * box.height) / 2;
  const left = Math.max(mx - halfW, -size.width / 2);
  const right = Math.min(mx + halfW, size.width / 2);
  const top = Math.max(my - halfH, -size.height / 2);
  const bottom = Math.min(my + halfH, size.height / 2);
  return { dx: (left + right) / 2, dy: (top + bottom) / 2, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function outside(clip: Clip, size: Size, frame: Size, f: number): boolean {
  const scale = at(clip, 'scale', f, 1);
  const visible = shown(clip, size, frame, f);
  const cx = (num(clip, 'x', 0.5) + at(clip, 'x', f, 0)) * frame.width + visible.dx * scale;
  const cy = (num(clip, 'y', 0.5) + at(clip, 'y', f, 0)) * frame.height + visible.dy * scale;
  const halfW = (visible.width * scale) / 2;
  const halfH = (visible.height * scale) / 2;
  const margin = (1 - UI_SAFE) / 2;
  return cx - halfW < frame.width * margin - 1 || cx + halfW > frame.width * (1 - margin) + 1 || cy - halfH < frame.height * margin - 1 || cy + halfH > frame.height * (1 - margin) + 1;
}

function placedClips(doc: MotionDoc): Clip[] {
  const top = doc.tracks.flatMap((t) => t.clips as Clip[]);
  const nested = top.flatMap((scene) => {
    const comp = scene.component === 'Precomp' ? doc.comps[String(scene.props.comp)] : undefined;
    const shift = scene.from - scene.trimStart;
    return comp ? comp.tracks.flatMap((t) => (t.clips as Clip[]).map((c) => ({ ...c, from: c.from + shift, bleed: c.bleed || scene.bleed }))) : [];
  });
  return [...top, ...nested];
}

const heldFrames = (clip: Clip, edge: number) => Array.from({ length: Math.max(0, clip.durationInFrames - 2 * edge) }, (_, i) => i + edge);

const MAX_READABLE_TILT = 12;
const TILTS = ['rotateX', 'rotateY'];
const READ_MATTER: ReadonlySet<ComponentId> = new Set([...TEXTS, 'Custom', 'Image'] as ComponentId[]);

function tiltedText(doc: MotionDoc): QualityProblem[] {
  const edge = Math.round(EDGE_SECONDS * doc.fps);
  return placedClips(doc).flatMap((clip) => {
    if (!READ_MATTER.has(clip.component)) {
      return [];
    }
    const tilt = (f: number) => Math.max(...TILTS.map((key) => Math.abs(at(clip, key, f, 0))));
    const leaning = heldFrames(clip, edge).filter((f) => tilt(f) > MAX_READABLE_TILT);
    if (leaning.length <= OUT_FRAMES_ALLOWED) {
      return [];
    }
    return [{ kind: Quality.TiltedText, at: seconds(doc, clip.from + leaning[0]), detail: `${clip.id} holds text or UI tilted ${Math.round(tilt(leaning[0]))}° in 3D from ${seconds(doc, clip.from + leaning[0])}s: it reads distorted. Tilt only on the entrance and straighten it (rotateX and rotateY within ${MAX_READABLE_TILT}°) once it has landed` }];
  });
}

function outOfFrame(doc: MotionDoc): QualityProblem[] {
  const frame = { width: doc.width, height: doc.height };
  const edge = Math.round(EDGE_SECONDS * doc.fps);
  return placedClips(doc).flatMap((clip) => {
    const size = contentSize(clip, frame);
    if (!size || clip.bleed) {
      return [];
    }
    const out = heldFrames(clip, edge).filter((f) => outside(clip, size, frame, f));
    if (out.length <= OUT_FRAMES_ALLOWED) {
      return [];
    }
    return [{ kind: Quality.OutOfFrame, at: seconds(doc, clip.from + out[0]), detail: `${clip.id} leaves the safe area (5% from each edge) for ${out.length} frames from ${seconds(doc, clip.from + out[0])}s: keep scale moves small and slow, move the camera or the position instead, or shrink it (zoom, width). If it runs off the edge on purpose (poster type, a full-bleed block), declare it: set_visibility bleed true` }];
  });
}

const EMPTY_SECONDS = 0.3;
const TRAILING_SECONDS = 0.2;
const FLASH_LUMA_JUMP = 200;

function holes(shown: readonly boolean[]): Span[] {
  const found: Span[] = [];
  shown.forEach((on, f) => {
    const open = found.at(-1);
    if (on) {
      return;
    }
    if (open && open.to === f) {
      open.to = f + 1;
      return;
    }
    found.push({ from: f, to: f + 1 });
  });
  return found;
}

function emptyFrames(doc: MotionDoc): QualityProblem[] {
  const shown = new Array<boolean>(doc.durationInFrames).fill(false);
  for (const span of shownSpans(doc, doc.tracks, 0, doc.durationInFrames)) {
    shown.fill(true, Math.max(0, span.from), Math.max(0, span.to));
  }

  return holes(shown)
    .filter((h) => h.to < doc.durationInFrames && h.to - h.from > EMPTY_SECONDS * doc.fps)
    .map((h) => ({ kind: Quality.EmptyFrames, at: seconds(doc, h.from), detail: `from ${seconds(doc, h.from)}s to ${seconds(doc, h.to)}s only the background is on screen: an empty hole the viewer reads as a mistake. Close the gap (start the next scene or its content sooner) or fill it` }));
}

function deadJunctions(doc: MotionDoc): QualityProblem[] {
  return doc.tracks
    .flatMap((t) => (t.kind === TrackKind.Visual ? (t.clips as Clip[]) : []))
    .flatMap((clip) => {
      const problem = clip.junction ? junctionProblem(doc, clip.id) : null;
      return problem ? [{ kind: Quality.DeadJunction, at: seconds(doc, clip.from), detail: `the ${clip.junction!.kind} transition into ${clip.id} at ${seconds(doc, clip.from)}s never plays, it is a hard cut: ${problem}` }] : [];
    });
}

function trailingEmpty(doc: MotionDoc): QualityProblem[] {
  const end = contentEnd(doc);
  if (doc.durationInFrames - end <= TRAILING_SECONDS * doc.fps) {
    return [];
  }
  return [{ kind: Quality.TrailingEmpty, at: seconds(doc, end), detail: `the content ends at ${seconds(doc, end)}s but the video runs to ${seconds(doc, doc.durationInFrames)}s: an empty or black tail. Run fit_duration (the last content plus the style hold), or hold the last frame on screen` }];
}

function flashes(stats: readonly FrameStat[]): QualityProblem[] {
  return stats.slice(1).flatMap((s, i) =>
    Math.abs(s.luma - stats[i].luma) >= FLASH_LUMA_JUMP
      ? [{ kind: Quality.EmptyFrames, at: s.time, detail: `the picture jumps from ${stats[i].luma > s.luma ? 'white to black' : 'black to white'} between ${stats[i].time}s and ${s.time}s: an unintended flash. Carry the move across (a dissolve, a matching background) unless it is a deliberate hit` }]
      : []
  );
}

const MIN_LOGO_WIDTH = 0.18;
const PIXEL = 1;
const ADDRESS = /\b[a-z0-9-]+\.[a-z]{2,}\b/i;

const overlaps = (a: Clip, b: Clip) => a.from < b.from + b.durationInFrames && b.from < a.from + a.durationInFrames;

function drawnWidth(clip: Clip, frame: Size, pixels: Pixels): number {
  const box = { width: num(clip, 'width', 0.2) * frame.width, height: num(clip, 'height', 0.2) * frame.height };
  const source = pixels[String(clip.props.assetId ?? '')] ?? { width: 1, height: 1 };
  const fit = Math.min(box.width / source.width, box.height / source.height);
  return source.width * fit * num(clip, 'scale', 1) * (clip.transform?.scale ?? 1);
}

function smallLogos(doc: MotionDoc, pixels: Pixels): QualityProblem[] {
  const frame = { width: doc.width, height: doc.height };
  const groups = [doc.tracks, ...Object.values(doc.comps).map((c) => c.tracks)].map((tracks) => tracks.flatMap((t) => t.clips as Clip[]));
  return groups.flatMap((clips) => {
    const addresses = clips.filter((c) => TEXTS.has(c.component) && ADDRESS.test(String(c.props.text ?? '')));
    return clips.flatMap((logo) => {
      const address = logo.component === 'Logo' ? addresses.find((a) => overlaps(a, logo)) : undefined;
      if (!address) {
        return [];
      }
      const width = drawnWidth(logo, frame, pixels);
      const floor = Math.max(MIN_LOGO_WIDTH * frame.width, textSize(address, frame).width);
      if (width + PIXEL >= floor) {
        return [];
      }
      return [{ kind: Quality.SmallLogo, at: seconds(doc, logo.from), detail: `${logo.id} draws the logo ${Math.round(width)} px wide next to the address ${address.id} (${Math.round(textSize(address, frame).width)} px): in the claim the logo is at least ${Math.round(MIN_LOGO_WIDTH * 100)}% of the frame width and never smaller than the address. Widen the logo box or shrink the address` }];
    });
  });
}

function clickMisses(doc: MotionDoc): QualityProblem[] {
  return [...cursorMisses(doc), ...reelMisses(doc)].map((m) => ({ kind: Quality.ClickMiss, at: seconds(doc, m.frame), detail: `${m.detail}. Every click lands inside the element it presses` }));
}

const uiClips = (doc: MotionDoc) => everyClip(doc).filter((c) => c.component === 'Custom' && isUiPiece(String(c.props.name ?? ''), doc.components[String(c.props.name ?? '')]?.source.js));

function emptyUis(doc: MotionDoc): QualityProblem[] {
  return uiClips(doc).flatMap((clip) => {
    const name = String(clip.props.name);
    const found = [...emptyContent(name, clip.props, doc.components[name]?.source.js), ...skeletons(name, clip.props, clip.durationInFrames / doc.fps)];
    return found.length ? [{ kind: Quality.EmptyUi, at: seconds(doc, clip.from), detail: `${clip.id} (${name}) shows no real content: ${found.join('; ')}. Fill it with the product's own data from the research: names, numbers and states a user of the product would recognise` }] : [];
  });
}

function stillUis(doc: MotionDoc): QualityProblem[] {
  const clicked = new Set(cursorClicks(doc).flatMap((c) => (c.target ? [c.target.split(TARGET_SEPARATOR)[0]] : [])));
  return uiClips(doc)
    .filter((clip) => interactionOf(String(clip.props.name), doc.components[String(clip.props.name)]?.source.js) === Interaction.Still && !clicked.has(clip.id))
    .map((clip) => ({ kind: Quality.NoMicroMotion, at: seconds(doc, clip.from), detail: `${clip.id} (${String(clip.props.name)}) only moves as a whole: nothing in it reacts. Press, hover or change a state on it (click_ui on an anchor), or morph it into the next UI` }));
}

function unscripted(doc: MotionDoc): QualityProblem[] {
  return STYLES[styleOf(doc)].script === Script.Required && !doc.script && everyClip(doc).length ? [{ kind: Quality.NoScript, detail: 'no research and script saved: for a launch film or trailer, write_script first (problem, struggle, flow, sourced proof, promise) and build that' }] : [];
}

const CUT_QUALITY: Record<CutFault, Quality> = {
  [CutFault.MidAnimation]: Quality.CutMidAnimation,
  [CutFault.NoHold]: Quality.NoHold
};

function drifted(doc: MotionDoc): QualityProblem[] {
  return scriptDrift(doc).map((p) => ({ kind: Quality.ScriptDrift, at: seconds(doc, p.frame), detail: p.detail }));
}

function cutsMidAnimation(doc: MotionDoc): QualityProblem[] {
  return cutProblems(doc).map((p) => ({ kind: CUT_QUALITY[p.fault], at: seconds(doc, p.frame), detail: p.detail }));
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

function liveScenes(doc: MotionDoc): QualityProblem[] {
  return liveComponents(doc).map((name) => {
    const first = clipsOf(doc).find((c) => c.component === 'Custom' && c.props.name === name);
    return { kind: Quality.LiveScene, at: seconds(doc, first?.from ?? 0), detail: liveNote([name]) };
  });
}

const STORY_MARK = /^story: /;

const realUi = (doc: MotionDoc, clip: Clip) => {
  const js = clip.component === 'Custom' ? doc.components[String(clip.props.name)]?.source.js : undefined;
  return Boolean(js && (VECTOR_TOKEN.test(js) || structureOf(js)));
};

function productUiMissing(doc: MotionDoc): QualityProblem[] {
  const story = Boolean(doc.script) || (doc.markers ?? []).some((m) => STORY_MARK.test(m.label));
  if (!story || everyClip(doc).some((c) => realUi(doc, c))) {
    return [];
  }
  return [{ kind: Quality.NoProductUi, detail: 'this product film never shows the real product: rebuild its UI with recreate_ui from the product url (its app screens) and show it with add_shot (device-fly-in, ui-focus, ui-morph, before-after, whip-zoom); generic kit cards do not count' }];
}

export function docProblems(doc: MotionDoc, input: { audioAssets: number; pixels?: Pixels; logos?: readonly string[]; referencesSeen?: boolean }): QualityProblem[] {
  const list = scenes(doc);
  const pixels = input.pixels ?? {};
  return [...unscripted(doc), ...productUiMissing(doc), ...drifted(doc), ...clickMisses(doc), ...emptyUis(doc), ...stillUis(doc), ...repeated(doc, list), ...smallTitles(doc), ...silent(doc, input.audioAssets), ...softPictures(doc, pixels), ...croppedScreens(doc, pixels), ...alteredLogos(doc, new Set(input.logos ?? [])), ...outOfFrame(doc), ...tiltedText(doc), ...emptyFrames(doc), ...trailingEmpty(doc), ...deadJunctions(doc), ...smallLogos(doc, pixels), ...cutsMidAnimation(doc), ...backgroundSeams(doc), ...liveScenes(doc), ...styleProblems(doc).map((p) => ({ kind: Quality.OffStyle, at: p.at, effect: p.effect, detail: p.detail })), ...lookProblems(doc, placedClips(doc), input.referencesSeen ?? false).map((p) => ({ kind: Quality.OffLook, effect: p.miss, detail: p.detail }))];
}

export function frameProblems(stats: readonly FrameStat[]): QualityProblem[] {
  return [...flatFrames(stats), ...flashes(stats)];
}

function flatFrames(stats: readonly FrameStat[]): QualityProblem[] {
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
