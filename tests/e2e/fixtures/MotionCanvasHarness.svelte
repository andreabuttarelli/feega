<script lang="ts">
  import CanvasFlow, { type Tile } from '$lib/components/canvas/CanvasFlow.svelte';
  import { nodeSize } from '$lib/canvas/node-size';
  import { PosterSource } from '$lib/canvas/poster-lod';
  import type { HarnessNode } from './motion-canvas-harness';

  let { nodes }: { nodes: HarnessNode[] } = $props();

  const DOM_ONLY = '-dom';
  const sourceOf = (node: HarnessNode) => (node.source?.startsWith(PosterSource.VideoFrame) ? PosterSource.VideoFrame : PosterSource.Image);
  const layered = (node: HarnessNode) => !node.source?.endsWith(DOM_ONLY);

  const tiles: Tile[] = nodes.map((node) => {
    const size = nodeSize('motion', { format: node.format });
    return { id: node.id, x: node.x, y: node.y, w: size.w, h: size.h, kind: 'motion', poster: layered(node) ? { url: node.poster, source: sourceOf(node) } : undefined };
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
</script>

<div class="harness">
  <CanvasFlow {tiles} onSelectionChange={() => (window.selectionEmits = (window.selectionEmits ?? 0) + 1)}>
    {#snippet tile({ id })}
      {@const node = byId.get(id)!}
      <div class="stage" data-testid="motion-node">
        {#if sourceOf(node) === PosterSource.VideoFrame}
          <video class="poster" src={node.poster} controls muted playsinline preload="metadata"></video>
        {:else}
          <img class="poster" src={node.poster} alt="" draggable="false" loading="lazy" decoding="async" />
        {/if}
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
