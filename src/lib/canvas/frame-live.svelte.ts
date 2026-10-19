import { nextLive } from './frame-live';

function liveFrame() {
  let id = $state<string | null>(null);

  return {
    get id() {
      return id;
    },
    toggle(frame: string) {
      id = nextLive(id, frame);
    },
    stop() {
      id = null;
    }
  };
}

export const frameLive = liveFrame();
