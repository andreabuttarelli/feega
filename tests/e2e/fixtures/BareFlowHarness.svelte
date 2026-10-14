<script lang="ts">
  import { SvelteFlow, type Edge, type Node } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';

  let { count }: { count: number } = $props();

  const STEP = { x: 100, y: 50 };
  const columns = Math.ceil(Math.sqrt(count));

  let nodes = $state.raw<Node[]>(
    Array.from({ length: count }, (_, i) => ({
      id: `stress-${i}`,
      position: { x: Math.floor(i / columns) * STEP.x, y: (i % columns) * STEP.y },
      data: { label: `Node ${i}` },
      style: 'width:50px;font-size:11px'
    }))
  );
  let edges = $state.raw<Edge[]>(
    Array.from({ length: count - 1 }, (_, i) => ({ id: `e${i}`, source: `stress-${i}`, target: `stress-${i + 1}` })).filter((_, i) => (i + 1) % columns !== 0)
  );
</script>

<div class="harness">
  <SvelteFlow bind:nodes bind:edges fitView minZoom={0.05} />
</div>

<style>
  .harness {
    position: fixed;
    inset: 0;
  }
</style>
