<script lang="ts">
  import { untrack } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import { FIT_PADDING, READABLE_ZOOM } from '$lib/canvas/placement';
  import { FocusMode, frameIn, type FocusRequest, type Insets } from '$lib/canvas/free-area';

  let { focus }: { focus: FocusRequest | null } = $props();

  const FIT_DURATION_MS = 250;
  const { fitView, getNodes, updateNode, getNodesBounds, setViewport } = useSvelteFlow();
  const EDIT_MAX_ZOOM = 2;


  function frameEdited(ids: readonly string[], free: Insets) {
    const flow = document.querySelector('.svelte-flow')?.getBoundingClientRect();
    if (!flow) {
      return;
    }
    void setViewport(frameIn(getNodesBounds([...ids]), { width: flow.width, height: flow.height }, free, EDIT_MAX_ZOOM), { duration: FIT_DURATION_MS });
  }

  function select(ids: readonly string[]) {
    for (const node of getNodes()) {
      updateNode(node.id, { selected: ids.includes(node.id) });
    }
  }

  $effect(() => {
    const ids = focus?.ids;
    const free = focus?.free;
    if (!ids?.length) {
      return;
    }
    if (focus?.mode === FocusMode.Select) {
      untrack(() => select(ids));
    }

    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => (free ? frameEdited(ids, free) : void fitView({ nodes: ids.map((id) => ({ id })), padding: FIT_PADDING, maxZoom: READABLE_ZOOM, duration: FIT_DURATION_MS })))
    );
    return () => cancelAnimationFrame(frame);
  });
</script>
