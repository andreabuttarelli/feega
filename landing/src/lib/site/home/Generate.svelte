<script lang="ts">
  import { GENERATE, GENERATE_STEPS } from '../generate';
  import Chapter from '../chapters/Chapter.svelte';
  import GenerateLoop from '../generate/GenerateLoop.svelte';
  import GenerateStepGlyph from '../generate/GenerateStepGlyph.svelte';
  import Features from './Features.svelte';
  import { Card } from './card';
</script>

<section class="chapter-block site-wide" id="generate">
  <Chapter copy={GENERATE} steps={GENERATE_STEPS} number="03">
    {#snippet art()}<GenerateLoop />{/snippet}
    {#snippet glyph(g)}<GenerateStepGlyph glyph={g} />{/snippet}
  </Chapter>

  <div class="proof">
    <Features cards={[Card.Generation]} />
  </div>
</section>
