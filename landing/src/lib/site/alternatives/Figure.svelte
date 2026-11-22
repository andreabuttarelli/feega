<script lang="ts">
  import type { Shot } from './alternative';

  let { shot }: { shot: Shot } = $props();
</script>

<figure class="shot" class:tall={shot.height > shot.width}>
  <img src={shot.src} alt={shot.alt} width={shot.width} height={shot.height} loading="lazy" decoding="async" />
  <figcaption>{shot.caption}</figcaption>
</figure>
