<script lang="ts">
  import { page } from '$app/state';
  import BrandLogo from '$lib/components/BrandLogo.svelte';
  /**
   * ASSET E BRAND DEL PROGETTO, DRAGGABILI SULLA TELA CHE È GIÀ APERTA.
   *
   * `/p/<progetto>/assets` e `/p/<progetto>/brands` hanno la stessa card, ma sono un'altra
   * rotta: un `dragstart` lì non arriva a un `ondrop` qui, la navigazione li separa. Questo
   * pannello vive in `CanvasLeftPanel`, aperto dalla rail flottante (`FloatingRail.svelte`), che
   * sta SEMPRE accanto alla tela — è l'unico posto da cui trascinare davvero funziona senza
   * aprire due schede.
   *
   * `assetDrag`/`brandFieldDrag` (`drag-payload.ts`) costruiscono lo stesso pacchetto delle
   * pagine dedicate: una card di qui e una di là finiscono sulla tela nello stesso modo.
   */
  import { assetDrag, CANVAS_DRAG_FILLED_NODE, serializeFilledNodeDrag } from '$lib/canvas/drag-payload';
  import { brandPieces, pieceDrag, type BrandDetails, type BrandPiece } from '$lib/canvas/brand-pieces';
  import { CANVAS_DRAG_MEDIUM } from '$lib/canvas/new-node';

  type PanelAsset = {
    id: string;
    type: string;
    url: string | null;
    signedUrl: string | null;
    content: string | null;
    mimeType: string | null;
  };

  type PanelBrand = {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    logoAssetId: string | null;
    shortDescription: string | null;
    content: string | null;
  };

  /** `kind` filtra cosa scarica e mostra: la rail apre Assets o Brands separati, un pannello alla
   *  volta (vedi CanvasLeftPanel.svelte); il default `'both'` è il comportamento di prima. */
  let { projectId, kind = 'both' }: { projectId: string; kind?: 'assets' | 'brands' | 'both' } = $props();
  const showAssets = $derived(kind !== 'brands');
  const showBrands = $derived(kind !== 'assets');

  let assets = $state<PanelAsset[]>([]);
  let brands = $state<PanelBrand[]>([]);
  let loading = $state(true);
  let failed = $state(false);
  let reload = $state(0);

  function retry() {
    reload += 1;
  }

  // `live` scarta risposte rimaste indietro: cambio progetto o un Riprova più veloce della
  // risposta precedente non devono lasciare sullo scaffale il materiale di un altro progetto.
  $effect(() => {
    const id = projectId;
    void reload;

    if (!id) {
      loading = false;
      failed = false;
      assets = [];
      brands = [];
      return;
    }

    let live = true;
    loading = true;
    failed = false;

    Promise.all([
      showAssets
        ? fetch(`/api/v1/projects/${id}/agent/assets`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        : Promise.resolve({ assets: [] }),
      showBrands
        ? fetch(`/api/v1/projects/${id}/agent/brands`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        : Promise.resolve({ brands: [] })
    ])
      .then(([assetsRes, brandsRes]: [{ assets?: PanelAsset[] }, { brands?: PanelBrand[] }]) => {
        if (!live) return;
        assets = assetsRes.assets ?? [];
        brands = brandsRes.brands ?? [];
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

  function onPieceDragStart(e: DragEvent, piece: BrandPiece) {
    const drag = pieceDrag(piece);
    if (!drag || !e.dataTransfer) {
      return;
    }

    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(CANVAS_DRAG_FILLED_NODE, serializeFilledNodeDrag(drag));
    e.dataTransfer.setData(CANVAS_DRAG_MEDIUM, drag.type);
  }

  const openKey = $derived(`feega:brands-panel-open:${projectId}`);
  let openBrands = $state<string[]>([]);
  let details = $state<Record<string, BrandDetails | 'loading' | 'failed'>>({});

  $effect(() => {
    try {
      openBrands = JSON.parse(localStorage.getItem(openKey) ?? '[]');
    } catch {
      openBrands = [];
    }
  });

  function saveOpen() {
    try {
      localStorage.setItem(openKey, JSON.stringify(openBrands));
    } catch {
      return;
    }
  }

  async function loadDetails(brandId: string) {
    details[brandId] = 'loading';
    const res = await fetch(`/api/v1/projects/${projectId}/agent/brands/${brandId}`).catch(() => null);
    details[brandId] = res?.ok ? ((await res.json()) as { details: BrandDetails }).details : 'failed';
  }

  $effect(() => {
    for (const brand of brands) {
      if (openBrands.includes(brand.id) && !details[brand.id]) {
        void loadDetails(brand.id);
      }
    }
  });

  function toggleBrand(brandId: string) {
    openBrands = openBrands.includes(brandId) ? openBrands.filter((id) => id !== brandId) : [...openBrands, brandId];
    saveOpen();
  }

  const PIECE_LABEL: Record<BrandPiece['kind'], (piece: BrandPiece) => string> = {
    logo: () => 'Logo',
    name: (p) => (p.kind === 'name' ? p.text : ''),
    description: (p) => (p.kind === 'description' ? p.text : ''),
    content: () => 'Brand document',
    colour: (p) => (p.kind === 'colour' ? p.hex : ''),
    handle: (p) => (p.kind === 'handle' ? `${p.platform} @${p.handle}` : ''),
    store: (p) => (p.kind === 'store' ? `Products · ${p.url}` : ''),
    website: (p) => (p.kind === 'website' ? p.url : '')
  };

  const PIECE_GROUP: Record<BrandPiece['kind'], string> = {
    logo: 'Logo',
    name: 'Name',
    description: 'Description',
    content: 'Content',
    colour: 'Colours',
    handle: 'Social',
    store: 'Products',
    website: 'Website'
  };

  const EMPTY_HINT = {
    assets: 'Nothing to drag yet. Generate or upload something first.',
    brands: 'No brands yet.',
    both: 'Nothing to drag yet. Generate or upload something first.'
  } as const;

  const newBrandHref = $derived(`/p/${projectId}/brands/new?returnTo=${encodeURIComponent(page.url.pathname)}`);

  const hasAnything = $derived((showAssets && assets.length > 0) || (showBrands && brands.length > 0));
</script>

<div class="panel">
  {#if showBrands}
    <a class="new-brand" href={newBrandHref}>+ New brand</a>
  {/if}
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
  {:else if !hasAnything}
    <p class="hint">{EMPTY_HINT[kind]}</p>
  {:else}
    {#if showAssets && assets.length}
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

    {#if showBrands && brands.length}
      <h4 class="section">Brands</h4>
      <div class="brand-list">
        {#each brands as brand (brand.id)}
          {@const open = openBrands.includes(brand.id)}
          {@const loaded = details[brand.id]}
          <div class="brand-card" data-brand-id={brand.id}>
            <button type="button" class="brand-head" aria-expanded={open} onclick={() => toggleBrand(brand.id)}>
              <span class="brand-logo">
                <BrandLogo name={brand.name} url={brand.logoUrl} />
              </span>
              <span class="brand-name">{brand.name}</span>
              <span class="chevron" class:open aria-hidden="true">›</span>
            </button>

            {#if open}
              <div class="pieces">
                {#if loaded === 'loading' || !loaded}
                  <p class="hint small">Loading…</p>
                {:else if loaded === 'failed'}
                  <button type="button" class="retry" onclick={() => loadDetails(brand.id)}>Retry</button>
                {:else}
                  {#each brandPieces(brand, loaded) as piece, i (i)}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div class="piece" data-piece={piece.kind} draggable="true" ondragstart={(e) => onPieceDragStart(e, piece)}>
                      <span class="piece-kind">{PIECE_GROUP[piece.kind]}</span>
                      {#if piece.kind === 'logo' && brand.logoUrl}
                        <img class="piece-thumb" src={brand.logoUrl} alt="" loading="lazy" />
                      {:else if piece.kind === 'colour'}
                        <span class="swatch" style="background:{piece.hex}"></span>
                      {/if}
                      <span class="piece-label">{PIECE_LABEL[piece.kind](piece)}</span>
                    </div>
                  {/each}
                {/if}
              </div>
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
    color: var(--ink-faint, #9a9a9e);
  }
  .section:first-child {
    margin-top: 2px;
  }

  .hint {
    margin: auto 0;
    padding: 16px 4px;
    text-align: center;
    font-size: 12.5px;
    color: var(--ink-soft, #6e6e73);
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
    color: var(--accent-ink, var(--accent, #7c5cff));
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
    border: 1px solid var(--line, #ededef);
    border-radius: 0;
    background: var(--paper-2, #f9f9f9);
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
    color: var(--ink-faint, #9a9a9e);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .skel {
    aspect-ratio: 1;
    border: 1px solid var(--line, #ededef);
    border-radius: 0;
    background: var(--paper-2, #f9f9f9);
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

  .new-brand {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 32px;
    margin-bottom: 12px;
    font-size: 13px;
    font-weight: 500;
    color: var(--ink, #1d1d1f);
    background: var(--paper, #fff);
    border: 1px solid var(--line, #ededef);
    text-decoration: none;
  }
  .new-brand:hover {
    background: var(--paper-2, #f9f9f9);
  }
  .new-brand:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .brand-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 2px 1px 10px;
  }
  .brand-card {
    border: 1px solid var(--line, #ededef);
    border-radius: 0;
    background: var(--paper-2, #f9f9f9);
  }
  .brand-head {
    appearance: none;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px;
    border: 0;
    border-radius: 0;
    background: transparent;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .brand-logo {
    width: 28px;
    height: 28px;
    flex: 0 0 auto;
    overflow: hidden;
    border: 1px solid var(--line, #ededef);
    border-radius: 0;
    background: var(--paper, #fff);
    display: grid;
    place-items: center;
    font-size: 10px;
  }
  .brand-name {
    min-width: 0;
    flex: 1;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .chevron {
    flex: 0 0 auto;
    color: var(--ink-faint, #9a9a9e);
    transition: transform 0.12s ease;
  }
  .chevron.open {
    transform: rotate(90deg);
  }
  .pieces {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0 6px 6px;
  }
  .hint.small {
    margin: 0;
    padding: 4px 0;
    font-size: 11.5px;
    text-align: left;
  }
  .piece {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    padding: 5px 6px;
    border: 1px solid var(--line, #ededef);
    border-radius: 0;
    background: var(--paper, #fff);
    cursor: grab;
  }
  .piece-kind {
    flex: 0 0 auto;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-faint, #9a9a9e);
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
    border: 1px solid var(--line, #ededef);
  }
  .piece-label {
    min-width: 0;
    flex: 1;
    font-size: 12px;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
