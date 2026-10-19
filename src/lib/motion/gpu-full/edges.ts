import { Ease, TransitionKind } from '../design';
import { EDGE_HIDDEN, EDGE_SHOWN, MOVES } from '../hyperframes/compose';
import { sampleTrack } from '../sample-track';
import type { Vars } from '../hyperframes/templates';

export type Pose = { opacity: number; x: number; y: number; scale: number; wipe: number; blur: number };

type Edge = { kind: TransitionKind; durationInFrames: number };
type Edged = { from: number; durationInFrames: number; transitionIn: Edge; transitionOut: Edge; props: Record<string, unknown> };

const PERCENT = 100;
const NUMBER = /-?[\d.]+/;

const numberIn = (v: unknown) => Number(NUMBER.exec(String(v))?.[0] ?? 0);

const READ: Record<keyof Pose, (vars: Vars) => number | undefined> = {
  opacity: (v) => (v.opacity === undefined ? undefined : Number(v.opacity)),
  x: (v) => (v.xPercent === undefined ? undefined : Number(v.xPercent) / PERCENT),
  y: (v) => (v.yPercent === undefined ? undefined : Number(v.yPercent) / PERCENT),
  scale: (v) => (v.scale === undefined ? undefined : Number(v.scale)),
  wipe: (v) => (v.clipPath === undefined ? undefined : String(v.clipPath).split(/\s+/).map(numberIn)[1] / PERCENT),
  blur: (v) => (v.filter === undefined ? undefined : numberIn(v.filter))
};

const poseOf = (vars: Vars, base: Pose): Pose => Object.fromEntries(Object.entries(READ).map(([k, read]) => [k, read(vars) ?? base[k as keyof Pose]])) as Pose;

export const SHOWN: Pose = poseOf(EDGE_SHOWN, { opacity: 1, x: 0, y: 0, scale: 1, wipe: 0, blur: 0 });

function between(a: Pose, b: Pose, at: number, from: number, length: number, ease: string): Pose {
  const track = (k: keyof Pose) => sampleTrack([{ frame: from, value: a[k], ease }, { frame: from + length, value: b[k], ease }], at);
  return Object.fromEntries(Object.keys(a).map((k) => [k, track(k as keyof Pose)])) as Pose;
}

function combine(a: Pose, b: Pose): Pose {
  return { opacity: a.opacity * b.opacity, x: a.x + b.x, y: a.y + b.y, scale: a.scale * b.scale, wipe: Math.max(a.wipe, b.wipe), blur: a.blur + b.blur };
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
