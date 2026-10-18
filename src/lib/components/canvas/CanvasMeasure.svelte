<script lang="ts">
  import { useStore, ViewportPortal } from '@xyflow/svelte';
  import type { Gap } from '$lib/motion/scene-select';
  import type { SnapGuide } from '$lib/canvas/snap';
  import MeasureLayer from './MeasureLayer.svelte';

  let { gaps = [], guides = [] }: { gaps?: Gap[]; guides?: SnapGuide[] } = $props();

  const store = useStore();
</script>

<ViewportPortal target="front">
  <MeasureLayer {gaps} {guides} zoom={store.viewport.zoom} />
</ViewportPortal>
