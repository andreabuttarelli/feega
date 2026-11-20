import type { Source } from '../messages';

export type SelectionSyncDeps = { reveal: (at: Source) => unknown; enabled: () => boolean; delayMs: number };

const sameSource = (a: Source | null, b: Source) => a !== null && a.file === b.file && a.line === b.line && a.col === b.col;

export function selectionSync({ reveal, enabled, delayMs }: SelectionSyncDeps) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let shown: Source | null = null;

  return (at: Source | null) => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!at) {
      shown = null;
      return;
    }
    if (!enabled() || sameSource(shown, at)) {
      return;
    }

    timer = setTimeout(() => {
      timer = null;
      shown = at;
      void reveal(at);
    }, delayMs);
  };
}
