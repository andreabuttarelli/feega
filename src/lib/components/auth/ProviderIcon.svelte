<script lang="ts">
  import { GLYPHS, type Provider } from './provider-icon';

  let { provider }: { provider: Provider } = $props();

  const glyph = $derived(GLYPHS[provider]);
</script>

<svg class="gh" viewBox={glyph.viewBox} width={glyph.width} height={glyph.height} aria-hidden="true">
  {#each glyph.paths as path (path.d)}
    <path fill={path.fill} d={path.d} />
  {/each}
</svg>
