<script lang="ts">
  import { untrack } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { FIT_PADDING, READABLE_ZOOM } from '$lib/canvas/placement';
  import { FocusMode, type FocusRequest } from '$lib/canvas/free-area';

  let { focus }: { focus: FocusRequest | null } = $props();

  const FIT_DURATION_MS = 250;
  const { fitView, getNodes, updateNode } = useSvelteFlow();

  function select(ids: readonly string[]) {
    for (const node of getNodes()) {
      updateNode(node.id, { selected: ids.includes(node.id) });
    }
  }

  $effect(() => {
    const ids = focus?.ids;
    const padding = focus?.padding ?? FIT_PADDING;
    if (!ids?.length) {
      return;
    }
    if (focus?.mode === FocusMode.Select) {
      untrack(() => select(ids));
    }

    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => void fitView({ nodes: ids.map((id) => ({ id })), padding, maxZoom: READABLE_ZOOM, duration: FIT_DURATION_MS }))
    );
    return () => cancelAnimationFrame(frame);
  });
</script>
