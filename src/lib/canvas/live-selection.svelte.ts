import type { LivePick, LivePreview } from '@feega/live-edit/live-fields';

export type LiveSelected = { nodeId: string; pick: LivePick | null; untagged: boolean; preview: (preview: LivePreview) => void };

export const liveSelection = $state<{ current: LiveSelected | null }>({ current: null });

export function selectLive(next: LiveSelected | null) {
  liveSelection.current = next;
}

export function dropLive(nodeId: string) {
  if (liveSelection.current?.nodeId === nodeId) {
    liveSelection.current = null;
  }
}
