<script lang="ts">
  import CanvasFlow from '$lib/components/canvas/CanvasFlow.svelte';
  import { CanvasMode } from '$lib/canvas/canvas-mode';
  import { renderDocHtml } from '$lib/canvas/doc-render';
  import type { SharedNode } from '$lib/canvas/shared-view';
  import { DEFAULT_EDGE_KIND } from '$lib/canvas/connect-rules';
  import '$lib/styles/doc-prose.css';

  let { data } = $props();

  const byId = $derived(new Map<string, SharedNode>(data.shared.nodes.map((n) => [n.id, n])));

  const tiles = $derived(
    data.shared.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, kind: n.type, displayName: n.displayName }))
  );

  const edges = $derived(
    data.shared.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, kind: DEFAULT_EDGE_KIND, markerEnd: { type: 'arrowclosed' as const } }))
  );
</script>

<svelte:head>
  <title>{data.shared.name}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="shared-canvas">
  <CanvasFlow {tiles} {edges} mode={CanvasMode.View}>
    {#snippet tile({ id })}
      {@const node = byId.get(id)}
      {#if node}
        <div class="view">
          {#if node.view.kind === 'image'}
            <img src={node.view.url} alt={node.displayName ?? ''} />
          {:else if node.view.kind === 'video'}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video src={node.view.url} controls playsinline class="nodrag"></video>
          {:else if node.view.kind === 'text'}
            <div class="prose doc-prose nowheel">{@html renderDocHtml(node.view.text)}</div>
          {:else if node.view.kind === 'doc'}
            <div class="prose doc-prose nowheel">{@html renderDocHtml(node.view.content)}</div>
          {:else if node.view.kind === 'frame' && node.view.url}
            <iframe src={node.view.url} title={node.displayName ?? 'embed'} sandbox="allow-scripts allow-same-origin"></iframe>
          {:else if node.view.kind === 'frame'}
            <iframe srcdoc={node.view.html} title={node.displayName ?? 'embed'} sandbox="allow-scripts"></iframe>
          {/if}
        </div>
      {/if}
    {/snippet}
  </CanvasFlow>

  <a class="mark" href="/">feega</a>
</main>

<style>
  .shared-canvas {
    position: fixed;
    inset: 0;
    background: var(--paper-2, #f9f9f9);
  }

  .shared-canvas :global(.svelte-flow__handle) {
    opacity: 0 !important;
    pointer-events: none;
  }

  .shared-canvas :global(.svelte-flow__node:focus),
  .shared-canvas :global(.svelte-flow__node:focus-visible),
  .shared-canvas :global(.tile-selection) {
    outline: none;
  }

  .view {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--paper, #fff);
    border: 1px solid var(--line, #ededef);
  }

  .view img,
  .view video,
  .view iframe {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
    border: 0;
  }

  .prose {
    height: 100%;
    overflow: auto;
    padding: 14px 16px;
    font-size: 13px;
  }

  .mark {
    position: fixed;
    left: 12px;
    bottom: 10px;
    z-index: 10;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--ink-faint, #9a9a9e);
    text-decoration: none;
  }
</style>
