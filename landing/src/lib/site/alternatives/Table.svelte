<script lang="ts">
  import { lower } from '../lower';
  import { slugify } from '../catalog/slug';
  import type { TableBlock } from './alternative';
  import { PixelIcon } from './pixel';
  import Callout from './Callout.svelte';
  import Pixel from './Pixel.svelte';

  let { block }: { block: TableBlock } = $props();
</script>

<section>
  <h2 id={slugify(block.heading)} class="with-icon"><Pixel icon={PixelIcon.Stack} size={4} />{lower(block.heading)}</h2>
  <div class="table scroll">
    <table>
      <thead>
        <tr>{#each block.head as cell, i (i)}<th scope="col">{@html cell}</th>{/each}</tr>
      </thead>
      <tbody>
        {#each block.rows as [first, ...cells] (first)}
          <tr>
            <th scope="row">{@html first}</th>
            {#each cells as cell, i (i)}<td>{@html cell}</td>{/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if block.callout}<Callout item={block.callout} />{/if}
</section>
