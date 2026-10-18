<script lang="ts">
  import { useStore, useSvelteFlow } from '@xyflow/svelte';
  import { centreOf, type View } from '$lib/realtime/canvas-presence';

  let { view, onView }: { view: View | null; onView?: (view: View) => void } = $props();

  const FOLLOW_EASE_MS = 120;
  const { setCenter } = useSvelteFlow();
  const store = useStore();

  $effect(() => {
    onView?.(centreOf(store.viewport, { width: store.width, height: store.height }));
  });

  $effect(() => {
    if (view) {
      void setCenter(view.cx, view.cy, { zoom: view.zoom, duration: FOLLOW_EASE_MS });
    }
  });
</script>
