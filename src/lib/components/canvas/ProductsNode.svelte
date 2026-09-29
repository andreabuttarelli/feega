<script lang="ts">
  import ShoppingBag from '@lucide/svelte/icons/shopping-bag';
  import SourcePreview, { type PreviewTile } from './SourcePreview.svelte';
  import type { ProductsNode } from '$lib/canvas/products-node';
  import type { Product } from '$lib/server/repos/products';

  let { node, products = [], total = 0 }: { node: ProductsNode; products?: Product[]; total?: number } = $props();

  const priceOf = (p: Product): string | null =>
    p.price === null ? null : `${p.price.toFixed(2)}${p.currency ? ` ${p.currency}` : ''}`;

  const tiles = $derived<PreviewTile[]>(
    products.map((product) => ({
      key: product.id,
      thumb: product.images[0]?.url ?? null,
      label: product.title,
      caption: priceOf(product),
      badge: product.images.length > 1 ? 'carousel' : null
    }))
  );

  const hostOf = (url: string): string => url.replace(/^https?:\/\//, '').replace(/\/$/, '');
</script>

<SourcePreview
  icon={ShoppingBag}
  title={node.url.trim() ? hostOf(node.url) : 'Products'}
  {tiles}
  {total}
  syncStatus={node.syncStatus}
  syncError={node.syncError}
  empty={node.url.trim() ? 'No products yet. Select the node to sync.' : 'Select the node to enter the store address.'}
/>
