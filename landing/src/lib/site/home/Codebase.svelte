<script lang="ts">
  import { CODEBASE, STEPS } from '../codebase';
  import Chapter from '../chapters/Chapter.svelte';
  import IsoGlyph from '../codebase/IsoGlyph.svelte';
  import HeroVideo from './HeroVideo.svelte';
</script>

<section class="chapter-block site-wide" id="codebase">
  <Chapter copy={CODEBASE} steps={STEPS} level="h2">
    {#snippet art()}<HeroVideo />{/snippet}
    {#snippet glyph(g)}<IsoGlyph glyph={g} />{/snippet}
  </Chapter>
</section>
