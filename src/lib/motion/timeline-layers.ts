import { compOf, type MotionClip, type MotionTrack } from './doc';
import { COMPONENTS } from './components';
import { FPS } from './design';
import { Interp, sampleTrack, type Keyframe } from './keyframes';
import { clampZoom, pxPerFrame } from './timeline-view';

export enum RowKind {
  Group = 'group',
  Layer = 'layer',
  Property = 'property'
}

export const ROW_PX: Record<RowKind, number> = {
  [RowKind.Group]: 28,
  [RowKind.Layer]: 28,
  [RowKind.Property]: 24
};

export type PropLane = { prop: string; label: string };

export type Row =
  | { kind: RowKind.Group; id: string; top: number; track: MotionTrack }
  | { kind: RowKind.Layer; id: string; top: number; track: MotionTrack; clip: MotionClip }
  | { kind: RowKind.Property; id: string; top: number; track: MotionTrack; clip: MotionClip; lane: PropLane };

export type RowView = { folded: readonly string[]; open: readonly string[]; lanes: (clip: MotionClip) => PropLane[] };

type Unplaced<R> = R extends Row ? Omit<R, 'top'> : never;

function trackRows(track: MotionTrack, view: RowView): Unplaced<Row>[] {
  const group: Unplaced<Row> = { kind: RowKind.Group, id: track.id, track };
  if (view.folded.includes(track.id)) {
    return [group];
  }
  return [
    group,
    ...(track.clips as MotionClip[]).flatMap((clip): Unplaced<Row>[] => [
      { kind: RowKind.Layer, id: clip.id, track, clip },
      ...(view.open.includes(clip.id) ? view.lanes(clip).map((lane) => ({ kind: RowKind.Property as const, id: `${clip.id}:${lane.prop}`, track, clip, lane })) : [])
    ])
  ];
}

export function layerRows(tracks: readonly MotionTrack[], view: RowView): Row[] {
  let top = 0;
  return tracks.flatMap((t) => trackRows(t, view)).map((row) => {
    const placed = { ...row, top } as Row;
    top += ROW_PX[row.kind];
    return placed;
  });
}

export const rowsHeight = (rows: readonly Row[]): number => rows.reduce((sum, r) => sum + ROW_PX[r.kind], 0);

export type RowWindow = { from: number; to: number; before: number; after: number };

function firstBelow(rows: readonly Row[], y: number): number {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].top + ROW_PX[rows[mid].kind] <= y) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

const UNMEASURED_VIEW_PX = 720;

export function rowWindow(rows: readonly Row[], scrolled: number, measured: number, overscan: number): RowWindow {
  if (!rows.length) {
    return { from: 0, to: 0, before: 0, after: 0 };
  }
  const view = measured > 0 ? measured : UNMEASURED_VIEW_PX;
  const from = Math.max(0, firstBelow(rows, scrolled) - overscan);
  const to = Math.min(rows.length, firstBelow(rows, scrolled + view) + overscan);
  const last = rows[rows.length - 1];
  const end = to < rows.length ? rows[to].top : last.top + ROW_PX[last.kind];
  return { from, to, before: rows[from]?.top ?? 0, after: last.top + ROW_PX[last.kind] - end };
}

export function layerName(clip: Pick<MotionClip, 'id' | 'component' | 'props'>, comps: Record<string, { name: string }>): string {
  const comp = compOf(clip as MotionClip);
  const custom = clip.component === 'Custom' ? (clip.props as { name?: string }).name : undefined;
  return `${custom ?? (comp ? comps[comp]?.name : undefined) ?? COMPONENTS[clip.component].label} · ${clip.id}`;
}

export enum KeyMark {
  Here = 'here',
  Animated = 'animated',
  None = 'none'
}

export function keyMark(keys: readonly Keyframe[], localFrame: number): KeyMark {
  if (!keys.length) {
    return KeyMark.None;
  }
  return keys.some((k) => k.frame === localFrame) ? KeyMark.Here : KeyMark.Animated;
}

const VALUE_PRECISION = 100;

export function propValue(keys: readonly Keyframe[], localFrame: number): string {
  if (keys.every((k) => typeof k.value === 'number')) {
    return String(Math.round(sampleTrack(keys as Parameters<typeof sampleTrack>[0], localFrame) * VALUE_PRECISION) / VALUE_PRECISION);
  }
  return String((keys.findLast((k) => k.frame <= localFrame) ?? keys[0])?.value ?? '');
}

export enum KeyGlyph {
  Diamond = 'diamond',
  Square = 'square',
  Circle = 'circle'
}

const INTERP_SHAPE: Record<Interp, KeyGlyph> = {
  [Interp.Bezier]: KeyGlyph.Diamond,
  [Interp.Auto]: KeyGlyph.Diamond,
  [Interp.Continuous]: KeyGlyph.Diamond,
  [Interp.Hold]: KeyGlyph.Square,
  [Interp.Linear]: KeyGlyph.Circle
};

export const keyGlyph = (key: Keyframe): KeyGlyph => INTERP_SHAPE[key.out ?? Interp.Bezier];

export type RulerMark = { frame: number; label: string | null };

const MAJOR_MIN_PX = 64;
const MINOR_MIN_PX = 6;
const FRAME_STEPS = [1, 5, 10];
const SECOND_STEPS = [1, 2, 5, 10, 30, 60];
const MINOR_DIVISIONS = [5, 4, 2];

const pad = (n: number) => String(n).padStart(2, '0');

function markLabel(frame: number, fps: number, step: number): string {
  const seconds = Math.floor(frame / fps);
  return step < fps ? `${pad(seconds)}:${pad(frame % fps)}f` : `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

function minorStep(major: number, ppf: number): number {
  return MINOR_DIVISIONS.map((d) => major / d).find((m) => Number.isInteger(m) && m * ppf >= MINOR_MIN_PX) ?? major;
}

export function rulerMarks(durationInFrames: number, zoom: number, fps: number = FPS): RulerMark[] {
  const ppf = pxPerFrame(zoom, fps);
  const steps = [...FRAME_STEPS.filter((f) => f < fps), ...SECOND_STEPS.map((s) => s * fps)];
  const major = steps.find((s) => s * ppf >= MAJOR_MIN_PX) ?? steps.at(-1)!;
  const minor = minorStep(major, ppf);
  const marks: RulerMark[] = [];
  for (let frame = 0; frame <= durationInFrames; frame += minor) {
    marks.push({ frame, label: frame % major === 0 ? markLabel(frame, fps, major) : null });
  }
  return marks;
}

export const pinched = (startZoom: number, startDistance: number, distance: number): number => clampZoom((startZoom * distance) / startDistance);
