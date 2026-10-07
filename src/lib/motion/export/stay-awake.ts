export type Page = {
  readonly hidden: boolean;
  addEventListener: (type: 'visibilitychange', fn: () => void) => void;
  removeEventListener: (type: 'visibilitychange', fn: () => void) => void;
};

type Sentinel = { release: () => Promise<void> };
export type WakeLockHost = { wakeLock?: { request: (type: 'screen') => Promise<Sentinel> } };

export function visibleGate(page: Page, onPause: (paused: boolean) => void): () => Promise<void> {
  return () => {
    if (!page.hidden) {
      return Promise.resolve();
    }
    onPause(true);
    return new Promise((resolve) => {
      const back = () => {
        if (page.hidden) {
          return;
        }
        page.removeEventListener('visibilitychange', back);
        onPause(false);
        resolve();
      };
      page.addEventListener('visibilitychange', back);
    });
  };
}

export async function keepAwake(host: WakeLockHost, page: Page): Promise<() => void> {
  if (!host.wakeLock) {
    return () => {};
  }
  let sentinel: Sentinel | null = null;
  const take = () => host.wakeLock?.request('screen').then((s) => (sentinel = s), () => (sentinel = null));
  const retake = () => {
    if (!page.hidden) {
      void take();
    }
  };
  await take();
  page.addEventListener('visibilitychange', retake);
  return () => {
    page.removeEventListener('visibilitychange', retake);
    void sentinel?.release().catch(() => {});
  };
}
