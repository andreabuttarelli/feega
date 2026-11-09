const ADOPT_WAIT_MS = 1000;

export function adoptBatch<T>(send: (entries: Record<string, T>) => void, waitMs = ADOPT_WAIT_MS): (entries: Record<string, T>) => void {
  let pending: Record<string, T> = {};
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (entries) => {
    pending = { ...pending, ...entries };
    if (timer) {
      return;
    }
    timer = setTimeout(() => {
      const out = pending;
      pending = {};
      timer = null;
      send(out);
    }, waitMs);
  };
}
