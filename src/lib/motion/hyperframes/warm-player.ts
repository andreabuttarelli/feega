import { Script, scriptUrl } from '../libs/catalog';

type WarmPorts = { fetch: (url: string, init: RequestInit) => Promise<Response>; load: () => Promise<unknown> };

export function playerWarmer(ports: WarmPorts) {
  let warming: Promise<void> | null = null;

  async function warm(origin: string) {
    const runtime = ports
      .fetch(scriptUrl(origin, Script.Runtime), { mode: 'cors', credentials: 'omit' })
      .then((res) => res.arrayBuffer());
    await Promise.allSettled([ports.load(), runtime]);
  }

  return (origin: string) => (warming ??= warm(origin));
}

export const warmPlayer = playerWarmer({ fetch: (url, init) => fetch(url, init), load: () => import('@hyperframes/player') });

const IDLE_FALLBACK_MS = 2000;

type Clock = { requestIdleCallback?: (job: () => void) => unknown; setTimeout: (job: () => void, ms: number) => unknown };

export function whenIdle(job: () => void, clock: Clock = globalThis) {
  if (clock.requestIdleCallback) {
    clock.requestIdleCallback(job);
    return;
  }
  clock.setTimeout(job, IDLE_FALLBACK_MS);
}
