import type { LeftPanelKind } from '$lib/components/canvas/CanvasLeftPanel.svelte';

let asked = $state(0);
let kind = $state<LeftPanelKind | null>(null);

export const leftPanelRequest = {
  get asked(): number {
    return asked;
  },
  get kind(): LeftPanelKind | null {
    return kind;
  },
  ask(panel: LeftPanelKind) {
    kind = panel;
    asked += 1;
  }
};
