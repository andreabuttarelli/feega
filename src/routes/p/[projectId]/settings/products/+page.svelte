<script lang="ts">
  import { ShoppingBag } from '@lucide/svelte';
  import { Panel } from '$lib/components/ui/panel';
  import { EmptyState } from '$lib/components/ui/empty-state';

  let { data } = $props();
</script>

<Panel title={`Products (${data.products.length})`}>
  {#if data.products.length}
    <div class="catalog">
      {#each data.products as p (p.id)}
        {@const image = Array.isArray(p.images) ? (p.images as { url?: string }[])[0]?.url : null}
        <div class="product">
          <div class="pimg" style={image ? `background-image:url(${image})` : ''}>
            {#if !image}<span class="ph">{(p.title ?? '?').slice(0, 1)}</span>{/if}
          </div>
          <div class="pinfo">
            <div class="ptitle">{p.title}</div>
            {#if p.price != null}<div class="pprice">{p.price} {p.currency ?? ''}</div>{/if}
            {#if !p.available}<div class="punavailable">Unavailable</div>{/if}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <EmptyState title="No products yet" description="Add a products node on the canvas, or run feega products <slug> sync to import the catalog from the connected store.">
      {#snippet icon()}<ShoppingBag />{/snippet}
    </EmptyState>
  {/if}
</Panel>

<style>
  .catalog { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
  .product { display: flex; flex-direction: column; gap: 8px; }
  .pimg {
    aspect-ratio: 1; background: var(--paper-2); border: 1px solid var(--line);
    background-size: cover; background-position: center;
    display: flex; align-items: center; justify-content: center;
  }
  .ph { font-size: 24px; font-weight: 700; color: var(--ink-faint); }
  .pinfo { display: flex; flex-direction: column; gap: 2px; }
  .ptitle { font-size: 13px; font-weight: 600; color: var(--ink); }
  .pprice { font-size: 12px; color: var(--ink-soft); }
  .punavailable { font-size: 11px; color: var(--amber); }
</style>
