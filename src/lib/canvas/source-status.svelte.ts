import { SvelteMap } from 'svelte/reactivity';
import type { SourceSync } from './core/frame-header';
import { syncOf } from './source-sync';

const POLL_MS = 60_000;
const SEPARATOR = '|';

type Answer = { ok?: boolean; state?: string };

export function sourceStatus(projectId: () => string, frames: () => string[], fetchFn: typeof fetch = fetch) {
  const states = new SvelteMap<string, SourceSync[]>();

  const statusOf = async (nodeId: string) => {
    const res = await fetchFn(`/api/v1/projects/${projectId()}/github/push?nodeId=${encodeURIComponent(nodeId)}`).catch(() => null);
    const body = (await res?.json().catch(() => null)) as Answer | null;
    states.set(nodeId, body?.ok && body.state ? syncOf(body.state) : []);
  };

  const watched = $derived(frames().join(SEPARATOR));
  const refresh = () => Promise.all(watched.split(SEPARATOR).filter(Boolean).map(statusOf));

  $effect(() => {
    if (!watched || !projectId()) {
      return;
    }
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  });

  return { of: (nodeId: string): SourceSync[] => states.get(nodeId) ?? [], refresh };
}
