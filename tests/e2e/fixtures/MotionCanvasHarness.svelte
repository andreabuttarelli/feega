<script lang="ts">
  import CanvasFlow, { type Tile } from '$lib/components/canvas/CanvasFlow.svelte';
  import { nodeSize } from '$lib/canvas/node-size';
  import type { HarnessNode } from './motion-canvas-harness';

  let { nodes }: { nodes: HarnessNode[] } = $props();

  const tiles: Tile[] = nodes.map((node) => {
    const size = nodeSize('motion', { format: node.format });
    return { id: node.id, x: node.x, y: node.y, w: size.w, h: size.h, kind: 'motion', poster: node.poster };
  });
  const posterOf = new Map(nodes.map((node) => [node.id, node.poster]));
</script>

<div class="harness">
  <CanvasFlow {tiles} onSelectionChange={() => (window.selectionEmits = (window.selectionEmits ?? 0) + 1)}>
    {#snippet tile({ id })}
      <div class="stage" data-testid="motion-node">
        <img class="poster" src={posterOf.get(id)} alt="" draggable="false" loading="lazy" decoding="async" />
      </div>
    {/snippet}
  </CanvasFlow>
</div>

<style>
  .harness {
    position: fixed;
    inset: 0;
  }
  .stage {
    width: 100%;
    height: 100%;
    background: #000;
  }
  .poster {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
