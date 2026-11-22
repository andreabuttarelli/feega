<script lang="ts">
  import { lower } from '../lower';
  import { PixelIcon } from './pixel';
  import Pixel from './Pixel.svelte';

  let { items }: { items: readonly string[] } = $props();
</script>

<aside class="takeaways" aria-labelledby="highlights">
  <h2 id="highlights" class="with-icon"><Pixel icon={PixelIcon.Start} size={4} />{lower('Highlights')}</h2>
  <ul>
    {#each items as item (item)}<li>{@html item}</li>{/each}
  </ul>
</aside>
