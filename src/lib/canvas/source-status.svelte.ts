import { SvelteMap } from 'svelte/reactivity';
import type { SourceSync } from './core/frame-header';
import { syncOf } from './source-sync';
import type { FrameSync } from './source-changes';

const POLL_MS = 60_000;
const SEPARATOR = '|';

type Answer = Partial<Omit<FrameSync, 'nodeId' | 'name'>> & { ok?: boolean };

export type Watched = { id: string; name: string };

export function sourceStatus(projectId: () => string, frames: () => Watched[], fetchFn: typeof fetch = fetch) {
  const syncs = new SvelteMap<string, FrameSync>();
  const names = $derived(new Map(frames().map((f) => [f.id, f.name])));

  const statusOf = async (nodeId: string) => {
    const res = await fetchFn(`/api/v1/projects/${projectId()}/github/push?nodeId=${encodeURIComponent(nodeId)}`).catch(() => null);
    const body = (await res?.json().catch(() => null)) as Answer | null;
    if (!body?.ok || !body.state || !body.link) {
      syncs.delete(nodeId);
      return;
    }
    syncs.set(nodeId, { nodeId, name: names.get(nodeId) ?? '', state: body.state, link: body.link, push: body.push ?? null });
  };

  const watched = $derived(frames().map((f) => f.id).join(SEPARATOR));
  const refresh = () => Promise.all(watched.split(SEPARATOR).filter(Boolean).map(statusOf));

  $effect(() => {
    if (!watched || !projectId()) {
      return;
    }
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  });

  return {
    of: (nodeId: string): SourceSync[] => syncOf(syncs.get(nodeId)?.state ?? ''),
    sync: (nodeId: string) => syncs.get(nodeId) ?? null,
    all: () => [...syncs.values()],
    refresh,
    forget: (nodeId: string) => syncs.delete(nodeId)
  };
}
