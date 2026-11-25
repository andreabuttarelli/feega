<script lang="ts">
  import { GLYPH, type Glyph } from '../../editor-mock/glyphs';

  let { name, size = 14 }: { name: Glyph; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html GLYPH[name]}</svg>
