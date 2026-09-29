<script lang="ts">
  import PageHead from '$lib/components/PageHead.svelte';
  import BrandLogo from '$lib/components/BrandLogo.svelte';
  import { Button } from '$lib/components/ui/button/index.js';
  import { brandExcerpt } from '$lib/brand-excerpt';
  import { brandFieldDrag, CANVAS_DRAG_FILLED_NODE, serializeFilledNodeDrag, type DragBrandField } from '$lib/canvas/drag-payload';
  import { CANVAS_DRAG_MEDIUM } from '$lib/canvas/new-node';
  import type { BrandCard } from './+page.server';

  let { data } = $props();

  const BRAND_EXCERPT_CHARS = 300;

  /** TRASCINARE UN CAMPO BRAND — `brandFieldDrag` (`drag-payload.ts`) porta la tabella "cosa
   *  diventa", la stessa che la sidebar del progetto usa per le sue card. */
  function onFieldDragStart(e: DragEvent, brand: BrandCard, field: DragBrandField) {
    const drag = brandFieldDrag(brand, field);
    if (!drag || !e.dataTransfer) return;

    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(CANVAS_DRAG_FILLED_NODE, serializeFilledNodeDrag(drag));
    e.dataTransfer.setData(CANVAS_DRAG_MEDIUM, drag.type);
  }
</script>

<div class="brands-page">
  <PageHead title="Brands" subtitle="Every brand your org has. Drag a logo, a text or the content onto a canvas.">
    {#snippet actions()}
      <Button href={`/p/${data.project.id}/brands/new`}>New brand</Button>
    {/snippet}
  </PageHead>

  {#if !data.brands.length}
    <div class="empty">
      <h3>No brands yet</h3>
      <p>Create one to get started.</p>
    </div>
  {:else}
    <div class="brand-grid">
      {#each data.brands as brand (brand.id)}
        <div class="brand-card">
          <div class="card-head">
            <!-- svelte-ignore a11y_no_static_element_interactions -- trascinare il logo è una
                 scorciatoia: chi non può trascinare arriva comunque al brand da /settings/brand. -->
            <div
              class="logo"
              draggable={Boolean(brand.logoAssetId)}
              ondragstart={(e) => onFieldDragStart(e, brand, 'logo')}
            >
              <BrandLogo name={brand.name} url={brand.logoUrl} />
            </div>

            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="names" draggable="true" ondragstart={(e) => onFieldDragStart(e, brand, 'text')}>
              <h3><a href={`/p/${data.project.id}/brands/${brand.slug}`}>{brand.name}</a></h3>
              {#if brand.shortDescription}
                <p class="short">{brand.shortDescription}</p>
              {/if}
            </div>
          </div>

          {#if brand.content}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="brand-excerpt" draggable="true" ondragstart={(e) => onFieldDragStart(e, brand, 'content')}>
              {brandExcerpt(brand.content, BRAND_EXCERPT_CHARS)}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .brands-page { max-width: var(--content-max, 1100px); margin: 0 auto; padding: 0; }


  .empty { text-align: center; padding: 48px 20px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .empty h3 { margin: 0; font-size: 18px; }
  .empty p { margin: 0; color: var(--ink-soft); }

  .brand-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }

  :global([data-viewport='mobile']) .brands-page { padding: 12px var(--page-gutter) 24px; }
  :global([data-viewport='mobile']) .brand-grid { grid-template-columns: minmax(0, 1fr); }
  .brand-card {
    background: var(--paper); border: 1px solid var(--line); padding: 16px;
    display: flex; flex-direction: column; gap: 12px;
  }

  .card-head { display: flex; align-items: center; gap: 12px; }
  .logo {
    width: 48px; height: 48px; flex: 0 0 auto; overflow: hidden;
    background: var(--paper); border: 1px solid var(--line);
    display: grid; place-items: center; cursor: grab;
  }
  .logo { font-size: 13px; }

  .names { flex: 1; min-width: 0; cursor: grab; }
  .names h3 { margin: 0; font-size: 14px; }
  .names h3 a { color: inherit; text-decoration: none; }
  .names h3 a:hover { text-decoration: underline; }
  .short { margin: 2px 0 0; font-size: 12px; color: var(--ink-soft); line-height: 1.4; }

  .brand-excerpt {
    font-size: 12px; line-height: 1.5; cursor: grab;
    max-height: 100px; overflow: hidden; white-space: pre-line; color: var(--ink-soft);
    border-top: 1px solid var(--line); padding-top: 10px;
  }
</style>
