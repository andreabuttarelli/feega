import type { MotionBlur } from '../motion-blur';
import { js } from './html';

type Tweenish = { vars: { ease?: unknown }; targets: () => unknown[]; startTime: () => number; duration: () => number; parent: Tweenish | null; invalidate: () => void };
type Timelineish = Tweenish & { getChildren: (nested: boolean, tweens: boolean, timelines: boolean) => Tweenish[] };
type Gsapish = { parseEase: (ease: unknown) => (p: number) => number };

export const HELD = 'data-blur="off"';

export function holdStill(tl: Timelineish, isHeld: (target: never) => boolean, fps: number, blur: Pick<MotionBlur, 'shutterAngle' | 'shutterPhase'>, gsapLib?: Gsapish): void {
  const lib = gsapLib ?? (globalThis as unknown as { gsap: Gsapish }).gsap;
  const centre = (blur.shutterPhase + blur.shutterAngle / 2) / 360;
  const frameTime = (t: number) => Math.max(0, Math.round(t * fps - centre)) / fps;
  const globalStart = (t: Tweenish) => {
    let start = 0;
    for (let node: Tweenish | null = t; node && node !== tl; node = node.parent) {
      start += node.startTime();
    }
    return start;
  };

  for (const tween of tl.getChildren(true, true, false)) {
    const duration = tween.duration();
    const targets = tween.targets();
    if (duration <= 0 || !targets.length || !targets.every((t) => isHeld(t as never))) {
      continue;
    }
    const start = globalStart(tween);
    const eased = lib.parseEase(tween.vars.ease ?? 'power1.out');
    tween.vars.ease = (p: number) => eased(Math.min(1, Math.max(0, (frameTime(start + p * duration) - start) / duration)));
    tween.invalidate();
  }
}

export function holdScript(fps: number, blur: Pick<MotionBlur, 'shutterAngle' | 'shutterPhase'>): string {
  const held = `function(el){return Boolean(el&&el.closest&&el.closest('[${HELD}]'));}`;
  return `(${holdStill.toString()})(tl,${held},${fps},${js({ shutterAngle: blur.shutterAngle, shutterPhase: blur.shutterPhase })});`;
}
