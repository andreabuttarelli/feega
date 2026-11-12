<script lang="ts">
  import { CODEBASE, STEPS } from '.';
  import Chapter from '../chapters/Chapter.svelte';
  import IsoLoop from './IsoLoop.svelte';
  import IsoGlyph from './IsoGlyph.svelte';
  import Frameworks from './Frameworks.svelte';

  let { level = 'h2', number }: { level?: 'h1' | 'h2'; number?: string } = $props();
</script>

<Chapter copy={CODEBASE} steps={STEPS} {level} {number}>
  {#snippet art()}<IsoLoop />{/snippet}
  {#snippet glyph(g)}<IsoGlyph glyph={g} />{/snippet}
  {#snippet footer()}<Frameworks />{/snippet}
</Chapter>
