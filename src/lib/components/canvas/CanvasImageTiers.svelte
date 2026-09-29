<script lang="ts">
  import { useNodes, useStore, useViewport } from '@xyflow/svelte';
  import { onDestroy } from 'svelte';
  import { planTiers, type TileView } from '$lib/canvas/image-tiers';
  import type { TierBoard } from '$lib/canvas/tier-board.svelte';

  const SETTLE_MS = 250;
  const FALLBACK_WIDTH = 320;
  const FALLBACK_HEIGHT = 240;
  const COARSE_POINTER = '(pointer: coarse)';
  const BUDGET_PX = { touch: 24_000_000, desktop: 120_000_000 };

  let { board }: { board: TierBoard } = $props();

  const nodesStore = useNodes();
  const viewport = useViewport();
  const store = useStore();

  let timer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;

  function budgetPx(): number {
    return matchMedia(COARSE_POINTER).matches ? BUDGET_PX.touch : BUDGET_PX.desktop;
  }

  function plan(width: number, height: number, view: { x: number; y: number; zoom: number }) {
    const tiles = nodesStore.current.map((node): TileView => {
      const w = node.measured?.width ?? node.width ?? FALLBACK_WIDTH;
      const h = node.measured?.height ?? node.height ?? FALLBACK_HEIGHT;
      const left = node.position.x * view.zoom + view.x;
      const top = node.position.y * view.zoom + view.y;
      const visible = left < width && top < height && left + w * view.zoom > 0 && top + h * view.zoom > 0;
      return { id: node.id, cssWidth: w, visible, current: board.of(node.id) };
    });

    board.apply(planTiers(tiles, { zoom: view.zoom, dpr: devicePixelRatio, budgetPx: budgetPx() }));
  }

  $effect(() => {
    const view = { ...viewport.current };
    const width = store.width;
    const height = store.height;
    void nodesStore.current;

    clearTimeout(timer);
    timer = setTimeout(() => plan(width, height, view), settled ? SETTLE_MS : 0);
    settled = true;
  });

  onDestroy(() => clearTimeout(timer));
</script>
