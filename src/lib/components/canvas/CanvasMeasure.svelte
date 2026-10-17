<script lang="ts">
  import { useStore, ViewportPortal } from '@xyflow/svelte';
  import type { Gap } from '$lib/motion/scene-select';
  import MeasureLayer from './MeasureLayer.svelte';

  let { gaps }: { gaps: Gap[] } = $props();

  const store = useStore();
</script>

<ViewportPortal target="front">
  <MeasureLayer {gaps} zoom={store.viewport.zoom} />
</ViewportPortal>
