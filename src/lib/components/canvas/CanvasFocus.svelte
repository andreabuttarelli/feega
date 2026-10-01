<script lang="ts">
  import { useSvelteFlow } from '@xyflow/svelte';
  import { FIT_PADDING, READABLE_ZOOM } from '$lib/canvas/placement';

  let { focus }: { focus: { ids: string[]; key: number } | null } = $props();

  const FIT_DURATION_MS = 250;
  const { fitView } = useSvelteFlow();

  $effect(() => {
    const ids = focus?.ids;
    if (!ids?.length) {
      return;
    }

    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => void fitView({ nodes: ids.map((id) => ({ id })), padding: FIT_PADDING, maxZoom: READABLE_ZOOM, duration: FIT_DURATION_MS }))
    );
    return () => cancelAnimationFrame(frame);
  });
</script>
