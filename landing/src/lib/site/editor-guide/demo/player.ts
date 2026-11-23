import { frameAt, type Frame, type Script } from './script';

const MAX_DELTA_MS = 100;

export type Player = { play: () => void; pause: () => void; reset: () => void };

export const createPlayer = (script: Script, show: (frame: Frame) => void): Player => {
  let raf = 0;
  let last = 0;
  let elapsed = 0;

  const tick = (now: number) => {
    elapsed = (elapsed + Math.min(now - last, MAX_DELTA_MS)) % script.duration;
    last = now;
    show(frameAt(script, elapsed));
    raf = requestAnimationFrame(tick);
  };

  const pause = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  return {
    play: () => {
      if (raf) {
        return;
      }

      last = performance.now();
      raf = requestAnimationFrame(tick);
    },
    pause,
    reset: () => {
      pause();
      elapsed = 0;
    }
  };
};
