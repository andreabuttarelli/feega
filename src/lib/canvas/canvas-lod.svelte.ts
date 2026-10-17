import { LOD_SETTLE_MS, lodNext } from './poster-lod';

export function lodGate(settleMs: number) {
  let far = $state(false);
  let moving = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  return {
    get far() {
      return far;
    },
    get moving() {
      return moving;
    },
    view(zoom: number) {
      moving = true;
      clearTimeout(timer);
      timer = setTimeout(() => {
        far = lodNext(far, zoom);
        moving = false;
      }, settleMs);
    }
  };
}

export const canvasLod = lodGate(LOD_SETTLE_MS);
