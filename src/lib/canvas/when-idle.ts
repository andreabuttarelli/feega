const FALLBACK_DELAY_MS = 50;

export function whenIdle(run: () => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(run);
    return () => cancelIdleCallback(handle);
  }

  const timer = setTimeout(run, FALLBACK_DELAY_MS);
  return () => clearTimeout(timer);
}
