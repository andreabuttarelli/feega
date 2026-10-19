export const CANVAS_LOAD_EVENT = 'canvas_load_timing';

export enum LoadKind {
  Navigation = 'navigation',
  InApp = 'in_app'
}

export function loadClaims() {
  let claimed = false;
  return (openedOn: string, here: string): LoadKind => {
    const first = !claimed && openedOn === here;
    claimed = true;
    return first ? LoadKind.Navigation : LoadKind.InApp;
  };
}

export const claimLoad = loadClaims();

const JANK_MS = 50;
const CALM_SPAN_MS = 500;

export type LoadReport = {
  kind: LoadKind;
  renderer: string;
  device: string;
  engine: string;
  nodes: number;
  revealed_ms: number;
  settled_ms: number;
  interactive_ms: number;
  missing_at_reveal: number;
  reveal_wait_ms: number;
};

type Ports = Pick<LoadReport, 'kind' | 'renderer' | 'device' | 'engine' | 'nodes'> & {
  now: () => number;
  raf: (frame: (t: number) => void) => void;
  report: (r: LoadReport) => void;
};

export function loadTiming({ now, raf, report, ...context }: Ports) {
  let revealedAt = 0;
  let missing = 0;
  let wait = 0;

  function watchCalm(settledAt: number) {
    let last = now();
    let calmSince = last;
    const frame = (t: number) => {
      if (t - last > JANK_MS) {
        calmSince = t;
      }
      last = t;
      if (t - calmSince < CALM_SPAN_MS) {
        raf(frame);
        return;
      }
      report({ ...context, revealed_ms: Math.round(revealedAt), settled_ms: Math.round(settledAt), interactive_ms: Math.round(calmSince), missing_at_reveal: missing, reveal_wait_ms: Math.round(wait) });
    };
    raf(frame);
  }

  return {
    revealed(missingAtReveal: number, waitedMs: number) {
      revealedAt = now();
      missing = missingAtReveal;
      wait = waitedMs;
    },
    settled() {
      watchCalm(now());
    }
  };
}
