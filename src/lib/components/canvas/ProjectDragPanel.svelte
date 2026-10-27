<script lang="ts">
  import { assetDrag, CANVAS_DRAG_FILLED_NODE, serializeFilledNodeDrag } from '$lib/canvas/drag-payload';
  import { CANVAS_DRAG_MEDIUM } from '$lib/canvas/new-node';

  type PanelAsset = {
    id: string;
    type: string;
    url: string | null;
    signedUrl: string | null;
    content: string | null;
    mimeType: string | null;
  };

  let { projectId }: { projectId: string } = $props();

  let assets = $state<PanelAsset[]>([]);
  let loading = $state(true);
  let failed = $state(false);
  let reload = $state(0);

  function retry() {
    reload += 1;
  }

  $effect(() => {
    const id = projectId;
    void reload;

    if (!id) {
      loading = false;
      failed = false;
      assets = [];
      return;
    }

    let live = true;
    loading = true;
    failed = false;

    fetch(`/api/v1/projects/${id}/agent/assets`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((assetsRes: { assets?: PanelAsset[] }) => {
        if (!live) return;
        assets = assetsRes.assets ?? [];
      })
      .catch(() => {
        if (live) failed = true;
      })
      .finally(() => {
        if (live) loading = false;
      });

    return () => {
      live = false;
    };
  });

  function onAssetDragStart(e: DragEvent, item: PanelAsset) {
    const drag = assetDrag(item);
    if (!drag || !e.dataTransfer) return;

    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(CANVAS_DRAG_FILLED_NODE, serializeFilledNodeDrag(drag));
    e.dataTransfer.setData(CANVAS_DRAG_MEDIUM, drag.type);
  }

  const EMPTY_HINT = 'Nothing to drag yet. Generate or upload something first.';
</script>

<div class="panel">
  {#if loading}
    <div class="grid" aria-hidden="true">
      {#each Array(6) as _}
        <span class="skel"></span>
      {/each}
    </div>
  {:else if failed}
    <div class="state">
      <p class="hint">Can't read the project's material.</p>
      <button type="button" class="retry" onclick={retry}>Retry</button>
    </div>
  {:else if assets.length === 0}
    <p class="hint">{EMPTY_HINT}</p>
  {:else}
    {#if assets.length}
      <h4 class="section">Assets</h4>
      <div class="grid">
        {#each assets as item (item.id)}
          {@const draggableItem = assetDrag(item)}
          <!-- svelte-ignore a11y_no_static_element_interactions -- trascinare è una scorciatoia,
               chi non può trascinare arriva comunque al materiale da /assets. -->
          <div
            class="tile"
            draggable={Boolean(draggableItem)}
            ondragstart={(e) => onAssetDragStart(e, item)}
          >
            {#if item.type === 'image' && item.signedUrl}
              <img src={item.signedUrl} alt="" loading="lazy" decoding="async" />
            {:else if item.type === 'video' && item.signedUrl}
              <video src={item.signedUrl} muted playsinline preload="metadata"></video>
            {:else}
              <span class="ph">{item.type}</span>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

  {/if}
</div>

<style>
  .panel {
    height: 100%;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    display: flex;
    flex-direction: column;
  }

  .section {
    margin: 10px 2px 6px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ui-text-tertiary);
  }
  .section:first-child {
    margin-top: 2px;
  }

  .hint {
    margin: auto 0;
    padding: 16px 4px;
    text-align: center;
    font-size: 12.5px;
    color: var(--ui-text-secondary);
  }
  .state {
    margin: auto 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 16px 4px;
  }
  .state .hint {
    margin: 0;
    padding: 0;
  }
  .retry {
    appearance: none;
    border: 0;
    background: transparent;
    padding: 2px 0;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    color: var(--ui-accent-text);
    cursor: pointer;
  }
  .retry:hover {
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 7px;
    padding: 2px 1px 10px;
  }
  .tile {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    border: 1px solid var(--ui-divider);
    border-radius: 0;
    background: var(--ui-wash);
  }
  .tile[draggable='true'] {
    cursor: grab;
  }
  .tile img,
  .tile video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .ph {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 10px;
    color: var(--ui-text-tertiary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .skel {
    aspect-ratio: 1;
    border: 1px solid var(--ui-divider);
    border-radius: 0;
    background: var(--ui-wash);
    animation: skel-pulse 1.2s ease-in-out infinite;
  }
  @keyframes skel-pulse {
    50% {
      opacity: 0.55;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .skel {
      animation: none;
    }
  }
</style>
