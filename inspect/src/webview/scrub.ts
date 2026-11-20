export const NUDGE_MS = 300;
export const HOLD_MS = 1500;

type Cancel = () => void;

export type LivePorts = {
  preview: (value: string) => void;
  commit: (value: string) => void;
  frame: (run: () => void) => void;
  later: (run: () => void, ms: number) => Cancel;
};

export function liveNumber({ preview, commit, frame, later }: LivePorts) {
  let pending: string | null = null;
  let cancelNudge: Cancel | null = null;

  const flush = () => {
    if (pending !== null) {
      preview(pending);
      pending = null;
    }
  };

  return {
    move(value: string) {
      if (pending === null) {
        frame(flush);
      }
      pending = value;
    },
    release(value: string) {
      pending = null;
      commit(value);
    },
    nudge(value: string) {
      preview(value);
      cancelNudge?.();
      cancelNudge = later(() => ((cancelNudge = null), commit(value)), NUDGE_MS);
    }
  };
}

export type Held = { value: number; since: number };

export function heldValue(held: Held, incoming: number | string, now: number): number | null {
  const expired = now - held.since >= HOLD_MS;
  return expired || incoming === held.value ? null : held.value;
}
