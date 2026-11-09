import { Readiness } from '@feega/motion-core/motion/gpu-full/media';

export enum OnScreen {
  Nothing = 'nothing',
  Thumb = 'thumb'
}

export function showStaged(ready: Promise<Readiness>, held: OnScreen, show: (r: Readiness) => void): Promise<void> {
  if (held === OnScreen.Nothing) {
    show(Readiness.Partial);
  }

  return ready.then((r) => {
    if (held === OnScreen.Nothing && r === Readiness.Partial) {
      return;
    }
    show(r);
  });
}
