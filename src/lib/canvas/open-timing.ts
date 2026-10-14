export enum OpenMark {
  Session = 'session',
  Chrome = 'chrome',
  Ready = 'ready',
  Shown = 'shown'
}

export enum OpenOutcome {
  Shown = 'shown',
  Closed = 'closed'
}

export type OpenPhases = { outcome: OpenOutcome; open_ms: number } & Record<`${OpenMark}_ms`, number | null>;

type Ports = { tap: number; now: () => number; report: (phases: OpenPhases) => void };

const TAP_WINDOW_MS = 2000;

export const tapTime = (lastPress: number | null, mountedAt: number) => (lastPress !== null && mountedAt - lastPress < TAP_WINDOW_MS ? lastPress : mountedAt);

export function openTiming({ tap, now, report }: Ports) {
  const opened = now();
  const at = new Map<OpenMark, number>();
  let reported = false;

  function send(outcome: OpenOutcome) {
    if (reported) {
      return;
    }
    reported = true;
    const since = (mark: OpenMark) => {
      const t = at.get(mark);
      return t === undefined ? null : Math.round(t - tap);
    };
    report({
      outcome,
      open_ms: Math.round(opened - tap),
      session_ms: since(OpenMark.Session),
      chrome_ms: since(OpenMark.Chrome),
      ready_ms: since(OpenMark.Ready),
      shown_ms: since(OpenMark.Shown)
    });
  }

  return {
    mark(mark: OpenMark) {
      if (at.has(mark)) {
        return;
      }
      at.set(mark, now());
      if (mark === OpenMark.Shown) {
        send(OpenOutcome.Shown);
      }
    },
    end() {
      send(OpenOutcome.Closed);
    }
  };
}
