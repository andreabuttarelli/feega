<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onTop, slab, type Box, type Shade } from './iso';

  let { box, shade, children }: { box: Box; shade: Shade; children?: Snippet } = $props();

  const faces = $derived(slab(box));
</script>

<g stroke={shade.line} stroke-width="0.6" stroke-linejoin="round">
  <polygon points={faces.left} fill={shade.left} />
  <polygon points={faces.right} fill={shade.right} />
  <polygon points={faces.top} fill={shade.top} />
</g>
{#if children}
  <g transform={onTop(box.x, box.y, box.t)}>{@render children()}</g>
{/if}
