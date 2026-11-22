<script lang="ts">
  import { slugify } from '../catalog/slug';
  import { lower } from '../lower';
  import type { Highlight } from './alternative';
  import VisualView from './Visual.svelte';

  let { item, flip }: { item: Highlight; flip: boolean } = $props();
</script>

<div class="highlight" class:flip>
  <div class="copy">
    <h3 id={slugify(item.heading)}>{lower(item.heading)}</h3>
    {#each item.paragraphs as p (p)}<p>{p}</p>{/each}
  </div>
  <figure>
    <VisualView visual={item.visual} />
    <figcaption>{item.caption}</figcaption>
  </figure>
</div>
