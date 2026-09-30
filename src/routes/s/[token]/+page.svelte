<script lang="ts">
  import CanvasFlow from '$lib/components/canvas/CanvasFlow.svelte';
  import { CanvasMode } from '$lib/canvas/canvas-mode';
  import { renderDocHtml } from '$lib/canvas/doc-render';
  import type { SharedNode } from '$lib/canvas/shared-view';
  import { NODE_KIND_ICON } from '$lib/canvas/node-label';
  import type { NodeType } from '$lib/canvas/node-data';
  import SourcePreview from '$lib/components/canvas/SourcePreview.svelte';
  import AudioPlayer from '$lib/components/canvas/AudioPlayer.svelte';
  import { DEFAULT_EDGE_KIND } from '$lib/canvas/connect-rules';
  import '$lib/styles/doc-prose.css';
  import { periodTitle } from '$lib/calendar/period-grid';
  import { CONNECTOR_STYLE } from '$lib/canvas/connectors';
  import LegalFooter from '$lib/components/LegalFooter.svelte';

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
  <h1 class="share-title">{data.shared.name}</h1>
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
          {:else if node.view.kind === 'audio'}
            <AudioPlayer src={node.view.url} cacheKey={node.id} />
          {:else if node.view.kind === 'text'}
            <div class="prose doc-prose nowheel">{@html renderDocHtml(node.view.text)}</div>
          {:else if node.view.kind === 'doc'}
            <div class="prose doc-prose nowheel">{@html renderDocHtml(node.view.content)}</div>
          {:else if node.view.kind === 'frame' && node.view.url}
            <iframe src={node.view.url} title={node.displayName ?? 'embed'} sandbox="allow-scripts allow-same-origin"></iframe>
          {:else if node.view.kind === 'frame'}
            <iframe srcdoc={node.view.html} title={node.displayName ?? 'embed'} sandbox="allow-scripts"></iframe>
          {:else if node.view.kind === 'grid'}
            <SourcePreview
              icon={NODE_KIND_ICON[node.type as NodeType]}
              title={node.displayName ?? ''}
              tiles={node.view.tiles}
              total={node.view.total}
              syncStatus="done"
              syncError={null}
              empty="Nothing here yet"
            />
          {:else if node.view.kind === 'list'}
            <ol class="items nowheel">
              {#each node.view.items as item, i (i)}
                <li>
                  <span class="index">{i + 1}</span>
                  {#if item.url}
                    <img class="thumb" src={item.url} alt={item.label} loading="lazy" />
                  {/if}
                  <span>{item.label || item.text}</span>
                </li>
              {/each}
            </ol>
          {:else if node.view.kind === 'select'}
            <p class="big">#{node.view.index}</p>
            {#if node.view.outputs.length}
              <ul class="outputs">
                {#each node.view.outputs as out (out.label)}
                  <li class:flagged={out.incompatible} style={`--port:${CONNECTOR_STYLE[out.port].color}`}>{out.label}</li>
                {/each}
              </ul>
            {/if}
          {:else if node.view.kind === 'influencer'}
            <figure class="face">
              {#if node.view.photo}
                <img src={node.view.photo} alt={node.view.name} />
              {/if}
              <figcaption><strong>{node.view.name}</strong>{#if node.view.summary}<span>{node.view.summary}</span>{/if}</figcaption>
            </figure>
          {:else if node.view.kind === 'post'}
            <article class="post nowheel">
              {#each node.view.media as url (url)}
                <img src={url} alt="" loading="lazy" />
              {/each}
              <p>{node.view.caption}</p>
            </article>
          {:else if node.view.kind === 'ads'}
            <p class="big">{node.view.query}<span>{node.view.country}</span></p>
          {:else if node.view.kind === 'calendar'}
            <p class="big">{periodTitle(node.view.view, node.view.anchor)}<span>Calendar</span></p>
          {:else}
            {@const Icon = NODE_KIND_ICON[node.type as NodeType]}
            <p class="empty"><Icon size={20} strokeWidth={1.6} />Nothing here yet</p>
          {/if}
        </div>
      {/if}
    {/snippet}
  </CanvasFlow>

  <a class="mark" href="/">feega</a>
  <div class="legal-mark">
    <LegalFooter />
  </div>
</main>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 100%;
    margin: 0;
    font-size: 13px;
    color: var(--ink-faint);
  }
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

  .items,
  .post {
    height: 100%;
    overflow: auto;
    margin: 0;
    padding: 10px 12px;
    font-size: 12px;
  }

  .items {
    list-style: none;
  }

  .items li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
    border-bottom: 1px solid var(--line, #ededef);
  }

  .index {
    color: var(--ink-faint, #9a9a9e);
  }

  .view .thumb {
    width: 32px;
    height: 32px;
    object-fit: cover;
  }

  .view .post img {
    height: auto;
    margin-bottom: 8px;
  }

  .big {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .big span {
    font-size: 11px;
    font-weight: 400;
    color: var(--ink-faint, #9a9a9e);
  }

  .face {
    display: flex;
    flex-direction: column;
    height: 100%;
    margin: 0;
  }

  .view .face img {
    flex: 1;
    min-height: 0;
    object-fit: cover;
  }

  .face figcaption {
    display: flex;
    flex-direction: column;
    padding: 8px 10px;
    font-size: 12px;
  }

  .share-title {
    position: fixed;
    z-index: 10;
    top: calc(8px + env(safe-area-inset-top, 0px));
    left: calc(8px + env(safe-area-inset-left, 0px));
    max-width: calc(100vw - 16px);
    margin: 0;
    padding: 10px 14px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 14px;
    font-weight: 600;
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
  }

  .mark {
    position: fixed;
    left: calc(12px + env(safe-area-inset-left, 0px));
    bottom: calc(10px + env(safe-area-inset-bottom, 0px));
    z-index: 10;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--ink-faint, #9a9a9e);
    text-decoration: none;
  }
  .legal-mark {
    position: fixed;
    right: calc(12px + env(safe-area-inset-right, 0px));
    bottom: calc(10px + env(safe-area-inset-bottom, 0px));
    z-index: 10;
  }
  .outputs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: 0;
    padding: 0 12px 12px;
    list-style: none;
  }
  .outputs li {
    padding: 2px 6px;
    font-size: 11px;
    font-weight: 600;
    color: var(--port);
    border: 1px solid var(--port);
  }
  .outputs li.flagged {
    border-style: dashed;
    text-decoration: line-through;
  }
</style>
