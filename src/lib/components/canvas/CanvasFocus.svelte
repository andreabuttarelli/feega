<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte';
  import { FIT_PADDING, READABLE_ZOOM } from '$lib/canvas/placement';
  import type { FocusRequest } from '$lib/canvas/free-area';

  let { focus }: { focus: FocusRequest | null } = $props();

  const FIT_DURATION_MS = 250;
  const { fitView } = useSvelteFlow();

  $effect(() => {
    const ids = focus?.ids;
    const padding = focus?.padding ?? FIT_PADDING;
    if (!ids?.length) {
      return;
    }

    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => void fitView({ nodes: ids.map((id) => ({ id })), padding, maxZoom: READABLE_ZOOM, duration: FIT_DURATION_MS }))
    );
    return () => cancelAnimationFrame(frame);
  });
</script>
