type Parkable = { stop: () => void; exited: (then: () => void) => void };

export type KeptServers<T extends Parkable> = ReturnType<typeof keptServers<T>>;

export function keptServers<T extends Parkable>(idleMs: number) {
  const parked = new Map<string, { server: T; timer: ReturnType<typeof setTimeout> }>();

  function release(root: string) {
    const entry = parked.get(root);
    if (entry) {
      clearTimeout(entry.timer);
      parked.delete(root);
    }
    return entry?.server ?? null;
  }

  function park(root: string, server: T) {
    release(root)?.stop();
    const timer = setTimeout(() => release(root)?.stop(), idleMs);
    timer.unref?.();
    parked.set(root, { server, timer });
    server.exited(() => parked.get(root)?.server === server && release(root));
  }

  function stopAll() {
    [...parked.keys()].forEach((root) => release(root)?.stop());
  }

  return { park, take: release, stopAll };
}
