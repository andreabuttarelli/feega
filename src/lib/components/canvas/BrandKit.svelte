<script lang="ts">
  import { CANVAS_DRAG_FILLED_NODE, serializeFilledNodeDrag, type FilledNodeDrag } from '$lib/canvas/drag-payload';
  import { brandPieces, pieceDrag, type BrandDetails, type BrandPiece, type PanelBrandBase } from '$lib/canvas/brand-pieces';
  import { CANVAS_DRAG_MEDIUM } from '$lib/canvas/new-node';

  let { projectId, brand }: { projectId: string; brand: PanelBrandBase & { id: string; logoUrl: string | null } } = $props();

  let details = $state<BrandDetails | 'loading' | 'failed'>('loading');

  async function load() {
    details = 'loading';
    const res = await fetch(`/api/v1/projects/${projectId}/agent/brands/${brand.id}`).catch(() => null);
    details = res?.ok ? ((await res.json()) as { details: BrandDetails }).details : 'failed';
  }

  $effect(() => {
    void load();
  });

  const KIT_KINDS = new Set<BrandPiece['kind']>(['content', 'handle', 'store', 'website']);

  const PIECE_LABEL: Record<BrandPiece['kind'], (piece: BrandPiece) => string> = {
    logo: () => 'Logo',
    name: (p) => (p.kind === 'name' ? p.text : ''),
    description: (p) => (p.kind === 'description' ? p.text : ''),
    content: () => 'Brand guidelines',
    colour: (p) => (p.kind === 'colour' ? p.hex : ''),
    handle: (p) => (p.kind === 'handle' ? `${p.platform} @${p.handle}` : ''),
    store: (p) => (p.kind === 'store' ? p.url : ''),
    website: (p) => (p.kind === 'website' ? p.url : '')
  };

  const PIECE_GROUP: Record<BrandPiece['kind'], string> = {
    logo: 'Logo',
    name: 'Name',
    description: 'Description',
    content: 'Guidelines',
    colour: 'Colours',
    handle: 'Social',
    store: 'Store',
    website: 'Website'
  };

  function startDrag(e: DragEvent, drag: FilledNodeDrag | null) {
    if (!drag || !e.dataTransfer) {
      return;
    }

    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(CANVAS_DRAG_FILLED_NODE, serializeFilledNodeDrag(drag));
    e.dataTransfer.setData(CANVAS_DRAG_MEDIUM, drag.type);
  }
</script>

{#if details === 'loading'}
  <p class="hint">Loading…</p>
{:else if details === 'failed'}
  <button type="button" class="retry" onclick={load}>Retry</button>
{:else}
  <div class="pieces">
    {#each brandPieces(brand, details).filter((piece) => KIT_KINDS.has(piece.kind)) as piece, i (i)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="piece" data-piece={piece.kind} draggable="true" ondragstart={(e) => startDrag(e, pieceDrag(piece))}>
        <span class="piece-kind">{PIECE_GROUP[piece.kind]}</span>
        {#if piece.kind === 'logo' && brand.logoUrl}
          <img class="piece-thumb" src={brand.logoUrl} alt="" loading="lazy" />
        {:else if piece.kind === 'colour'}
          <span class="swatch" style="background:{piece.hex}"></span>
        {/if}
        <span class="piece-label">{PIECE_LABEL[piece.kind](piece)}</span>
      </div>
    {/each}
  </div>
{/if}

<style>
  .pieces {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .piece {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    padding: 5px 6px;
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-panel);
    cursor: grab;
  }
  .piece-kind {
    flex: 0 0 auto;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ui-text-tertiary);
  }
  .piece-thumb {
    width: 18px;
    height: 18px;
    object-fit: cover;
    display: block;
  }
  .swatch {
    width: 14px;
    height: 14px;
    flex: 0 0 auto;
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-xs);
  }
  .piece-label {
    min-width: 0;
    flex: 1;
    font-size: 12px;
    color: var(--ui-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hint {
    padding: 16px 4px;
    text-align: center;
    font-size: 12.5px;
    color: var(--ui-text-secondary);
  }
  .retry {
    border: 0;
    background: transparent;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    color: var(--ui-accent-text);
    cursor: pointer;
  }
</style>
