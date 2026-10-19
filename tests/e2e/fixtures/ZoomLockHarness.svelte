<script lang="ts">
  import { SvelteFlow, type Node } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import CanvasZoomLock from '$lib/components/canvas/CanvasZoomLock.svelte';

  let nodes = $state.raw<Node[]>([{ id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } }]);
</script>

<div class="shell">
  <aside data-testid="panel">
    panel
    <div class="bar" data-testid="bar">
      <input data-testid="bar-input" />
      {#each Array.from({ length: 80 }, (_, i) => i) as line (line)}<p>line {line}</p>{/each}
    </div>
  </aside>
  <div class="flow">
    <SvelteFlow bind:nodes initialViewport={{ x: 0, y: 0, zoom: 1 }} zoomOnScroll={false} panOnScroll>
      <CanvasZoomLock />
    </SvelteFlow>
  </div>
</div>

<style>
  .shell {
    position: fixed;
    inset: 0;
    display: flex;
  }
  aside {
    width: 240px;
  }
  .bar {
    height: 300px;
    overflow: auto;
  }
  input {
    font-size: 12px;
  }
  .flow {
    flex: 1;
  }
</style>
