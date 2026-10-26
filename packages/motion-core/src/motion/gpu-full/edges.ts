import { Ease, TransitionKind } from '../design';
import { EDGE_HIDDEN, EDGE_SHOWN, MOVES } from '../hyperframes/compose';
import { sampleTrack } from '../sample-track';
import type { JunctionMove } from '../junctions';
import type { Vars } from '../hyperframes/templates';

export type Pose = { opacity: number; x: number; y: number; scale: number; wipe: number; wipeLeft: number; blur: number; dim: number };

type Edge = { kind: TransitionKind; durationInFrames: number };
type Edged = { from: number; durationInFrames: number; transitionIn: Edge; transitionOut: Edge; props: Record<string, unknown> };

const PERCENT = 100;
const BLUR = 'blur';
const BRIGHTNESS = /^brightness\(([\d.]+)\)/;
const RIGHT_INSET = 1;
const LEFT_INSET = 3;
const NUMBER = /-?[\d.]+/;

const numberIn = (v: unknown) => Number(NUMBER.exec(String(v))?.[0] ?? 0);

const READ: Record<keyof Pose, (vars: Vars) => number | undefined> = {
  opacity: (v) => (v.opacity === undefined ? undefined : Number(v.opacity)),
  x: (v) => (v.xPercent === undefined ? undefined : Number(v.xPercent) / PERCENT),
  y: (v) => (v.yPercent === undefined ? undefined : Number(v.yPercent) / PERCENT),
  scale: (v) => (v.scale === undefined ? undefined : Number(v.scale)),
  wipe: (v) => (v.clipPath === undefined ? undefined : String(v.clipPath).split(/\s+/).map(numberIn)[RIGHT_INSET] / PERCENT),
  wipeLeft: (v) => (v.clipPath === undefined ? undefined : String(v.clipPath).split(/\s+/).map(numberIn)[LEFT_INSET] / PERCENT),
  blur: (v) => (v.filter === undefined || !String(v.filter).startsWith(BLUR) ? undefined : numberIn(v.filter)),
  dim: (v) => (v.filter === undefined ? undefined : (BRIGHTNESS.exec(String(v.filter))?.[1] === undefined ? undefined : Number(BRIGHTNESS.exec(String(v.filter))![1])))
};

const poseOf = (vars: Vars, base: Pose): Pose => Object.fromEntries(Object.entries(READ).map(([k, read]) => [k, read(vars) ?? base[k as keyof Pose]])) as Pose;

export const SHOWN: Pose = poseOf(EDGE_SHOWN, { opacity: 1, x: 0, y: 0, scale: 1, wipe: 0, wipeLeft: 0, blur: 0, dim: 1 });

function between(a: Pose, b: Pose, at: number, from: number, length: number, ease: string): Pose {
  const track = (k: keyof Pose) => sampleTrack([{ frame: from, value: a[k], ease }, { frame: from + length, value: b[k], ease }], at);
  const sampled = Object.fromEntries(Object.keys(a).map((k) => [k, track(k as keyof Pose)])) as Pose;
  return { ...sampled, opacity: Math.min(1, Math.max(0, sampled.opacity)) };
}

function combine(a: Pose, b: Pose): Pose {
  return { opacity: a.opacity * b.opacity, x: a.x + b.x, y: a.y + b.y, scale: a.scale * b.scale, wipe: Math.max(a.wipe, b.wipe), wipeLeft: Math.max(a.wipeLeft, b.wipeLeft), blur: a.blur + b.blur, dim: a.dim * b.dim };
}

export function edgeAt(clip: Edged, frame: number): Pose {
  const enter = clip.transitionIn;
  const exit = clip.transitionOut;
  const end = clip.from + clip.durationInFrames;
  const entering = enter.kind !== TransitionKind.None && enter.durationInFrames > 0 ? between(poseOf(EDGE_HIDDEN[enter.kind], SHOWN), SHOWN, frame, clip.from, enter.durationInFrames, Ease.Enter) : SHOWN;
  const exiting = exit.kind !== TransitionKind.None && exit.durationInFrames > 0 ? between(SHOWN, poseOf(EDGE_HIDDEN[exit.kind], SHOWN), frame, end - exit.durationInFrames, exit.durationInFrames, Ease.Exit) : SHOWN;
  return combine(entering, exiting);
}

export function moveAt(clip: Edged, frame: number): Pose {
  const move = MOVES[(clip.props.move as keyof typeof MOVES) ?? 'none'] ?? MOVES.none;
  return between(poseOf(move.from, SHOWN), poseOf(move.to, SHOWN), frame, clip.from, clip.durationInFrames, String(clip.props.easing ?? Ease.Standard));
}

export function junctionPoseAt(moves: readonly JunctionMove[], frame: number): Pose {
  const started = moves.filter((m) => frame >= m.at).sort((a, b) => a.at - b.at);
  return started.reduce<Pose>((pose, m) => {
    const sampled = between(poseOf(m.from, SHOWN), poseOf(m.to, SHOWN), frame, m.at, m.length, m.ease);
    const owned = Object.keys(READ).filter((k) => READ[k as keyof Pose](m.to) !== undefined);
    return { ...pose, ...Object.fromEntries(owned.map((k) => [k, sampled[k as keyof Pose]])) };
  }, SHOWN);
}

export const composePoses = combine;
