import { Ease } from '@feega/motion-core/motion/design';
import { bezierOf } from '@feega/motion-core/motion/graph';
import { isSpring, sampleTrack, type EaseSpec } from '@feega/motion-core/motion/keyframes';

const LINEAR_STOPS = 40;
const DECIMALS = 1000;

const round = (n: number) => Math.round(n * DECIMALS) / DECIMALS;

function linearStops(ease: EaseSpec, intensity?: number): string {
  const track = [
    { frame: 0, value: 0, ease, intensity },
    { frame: LINEAR_STOPS, value: 1, ease: Ease.Linear }
  ];
  const stops = Array.from({ length: LINEAR_STOPS + 1 }, (_, i) => round(sampleTrack(track, i)));
  return `linear(${stops.join(', ')})`;
}

export function easeCss(ease: EaseSpec, intensity?: number): string {
  if (isSpring(ease)) {
    return linearStops(ease, intensity);
  }
  return `cubic-bezier(${bezierOf(ease).map(round).join(', ')})`;
}
