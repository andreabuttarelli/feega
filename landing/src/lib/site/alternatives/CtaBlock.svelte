<script lang="ts">
  import { PixelIcon } from './pixel';
  import type { Cta } from './alternative';
  import Pixel from './Pixel.svelte';

  let { item }: { item: Cta } = $props();
</script>

<div class="cta-block">
  <Pixel icon={PixelIcon.Start} size={6} />
  <p>{item.text}</p>
  <a class="landing-cta" href={item.href} rel={item.href.startsWith('/') ? undefined : 'noopener'}>{item.label} →</a>
</div>
