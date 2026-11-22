<script lang="ts">
  import type { Figure } from './topic';

  let { figure, eager = false }: { figure: Figure; eager?: boolean } = $props();
</script>

<figure class="topic-figure">
  <img src={figure.src} alt={figure.alt} width={figure.width} height={figure.height} loading={eager ? 'eager' : 'lazy'} decoding="async" />
</figure>
