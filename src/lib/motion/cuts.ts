import { COMPONENTS, TrackKind } from './components';
import type { MotionDoc } from './doc';
import { UI_KIT } from './ui-kit/kit';
import { settleTime } from './ui-kit/render';

export enum CutFault {
  MidAnimation = 'mid-animation',
  NoHold = 'no-hold'
}

export type CutProblem = { fault: CutFault; frame: number; detail: string };

type Clip = MotionDoc['tracks'][number]['clips'][number];

const HOLD_S = 1;
const EDGE_FRAMES = 1;
const LOOKAHEAD_S = 4;

const DRIFT_SECONDS = 2;

const DRIFT_RATE: Readonly<Record<string, number>> = {
  scale: 0.05,
  scaleX: 0.05,
  scaleY: 0.05,
  dolly: 0.08,
  zoom: 0.08,
  x: 0.03,
  y: 0.03,
  rotate: 6,
  orbit: 12,
  objectRotateX: 12,
  objectRotateY: 12,
  objectRotateZ: 12
};

const PIECES = new Map(Object.values(UI_KIT).map((p) => [p.name, p]));

const round = (n: number) => Math.round(n * 100) / 100;

const cutOf = (clip: Clip) => clip.durationInFrames - Math.max(clip.transitionOut?.durationInFrames ?? 0, Math.ceil((clip.junction?.durationInFrames ?? 0) / 2));

const visual = (clip: Clip) => COMPONENTS[clip.component]?.track === TrackKind.Visual;

function pieceSettle(doc: MotionDoc, clip: Clip): number {
  const piece = clip.component === 'Custom' ? PIECES.get(String(clip.props.name)) : undefined;
  return piece ? settleTime(piece.js, clip.props, clip.durationInFrames / doc.fps, 1 / doc.fps, LOOKAHEAD_S) * doc.fps : 0;
}

type Moves = { settle: number; past: number[] };

const drifts = (prop: string, change: number, seconds: number) => seconds >= DRIFT_SECONDS || (prop in DRIFT_RATE && seconds > 0 && Math.abs(change) / seconds <= DRIFT_RATE[prop]);

function keyMoves(doc: MotionDoc, clip: Clip, cut: number): Moves {
  const hold = HOLD_S * doc.fps;
  const segments = Object.entries(clip.keyframes).flatMap(([prop, track]) => (track ?? []).slice(1).map((k, i) => ({ from: track[i].frame, to: k.frame, landed: i > 0, moves: Number(k.value) !== Number(track[i].value), drifts: drifts(prop, Number(k.value) - Number(track[i].value), (k.frame - track[i].frame) / doc.fps) })));
  const exit = (s: { from: number; to: number; landed: boolean }) => s.landed && s.from >= cut - hold && s.to >= cut - EDGE_FRAMES;
  const counted = segments.filter((s) => s.moves && !s.drifts && !exit(s));
  return { settle: Math.max(0, ...counted.filter((s) => s.to <= cut).map((s) => s.to)), past: counted.filter((s) => s.to > cut).map((s) => s.to) };
}

type Reading = { settle: number; problems: CutProblem[] };

function readClip(doc: MotionDoc, clip: Clip, offset: number, seen: ReadonlySet<string>): Reading {
  if (!visual(clip)) {
    return { settle: 0, problems: [] };
  }
  const cut = cutOf(clip);
  const moves = keyMoves(doc, clip, cut);
  const comp = String(clip.props.comp ?? '');
  const inner = clip.component === 'Precomp' && !seen.has(comp) ? doc.comps[comp] : undefined;
  const nested = new Set([...seen, comp]);
  const children = (inner?.tracks.flatMap((t) => t.clips as Clip[]) ?? [])
    .filter((c) => c.from < cut)
    .map((c) => ({ from: c.from, read: readClip(doc, { ...c, durationInFrames: Math.min(c.durationInFrames, cut - c.from) }, offset + clip.from, nested) }));
  const settle = Math.max(moves.settle, pieceSettle(doc, clip), ...children.map((c) => c.from + c.read.settle));
  const at = offset + clip.from + cut;
  const late = Math.max(settle, ...moves.past);

  const own = late > cut + EDGE_FRAMES ? [{ fault: CutFault.MidAnimation, frame: at, detail: `${clip.id} is cut at ${round(at / doc.fps)}s while it still animates (it settles ${round(late / doc.fps)}s in): let every animation finish, then hold ${HOLD_S}s before the cut` }] : [];
  return { settle, problems: [...own, ...children.flatMap((c) => c.read.problems)] };
}

function noHold(doc: MotionDoc, clip: Clip, settle: number): CutProblem[] {
  const cut = cutOf(clip);
  const need = settle + HOLD_S * doc.fps;
  if (settle <= 0 || need <= cut + EDGE_FRAMES) {
    return [];
  }
  return [{ fault: CutFault.NoHold, frame: clip.from + cut, detail: `${clip.id} is cut ${round((cut - settle) / doc.fps)}s after its last animation: hold the finished state at least ${HOLD_S}s (make it ${round(need / doc.fps)}s long or start its animations sooner)` }];
}

export function cutProblems(doc: MotionDoc): CutProblem[] {
  return doc.tracks
    .flatMap((t) => t.clips as Clip[])
    .flatMap((clip) => {
      const read = readClip(doc, clip, 0, new Set());
      return read.problems.length ? read.problems : noHold(doc, clip, read.settle);
    });
}
