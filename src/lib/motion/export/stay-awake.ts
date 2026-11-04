export type Page = {
  readonly hidden: boolean;
  addEventListener: (type: 'visibilitychange', fn: () => void) => void;
  removeEventListener: (type: 'visibilitychange', fn: () => void) => void;
};

type Sentinel = { release: () => Promise<void> };
export type WakeLockHost = { wakeLock?: { request: (type: 'screen') => Promise<Sentinel> } };

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
