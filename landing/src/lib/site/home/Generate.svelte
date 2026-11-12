<script lang="ts">
  import { GENERATE, GENERATE_STEPS } from '../generate';
  import Chapter from '../chapters/Chapter.svelte';
  import GenerateLoop from '../generate/GenerateLoop.svelte';
  import GenerateStepGlyph from '../generate/GenerateStepGlyph.svelte';
  import ProofPair from './ProofPair.svelte';
  import Features from './Features.svelte';
  import { Card } from './card';
</script>

<section class="chapter-block site-wide" id="generate">
  <Chapter copy={GENERATE} steps={GENERATE_STEPS} number="03">
    {#snippet art()}<GenerateLoop />{/snippet}
    {#snippet glyph(g)}<GenerateStepGlyph glyph={g} />{/snippet}
  </Chapter>

  <div class="proof">
    <ProofPair eyebrow="No lock-ins" heading="Switch between different providers" text="Bring your own models: OpenRouter, ElevenLabs and more.">
      {#snippet media()}
        <img src="/site/home/providers.webp" alt="A Feega node picking the cheapest provider for a run" width="1328" height="778" loading="lazy" decoding="async" />
      {/snippet}
    </ProofPair>

    <Features cards={[Card.Generation, Card.Agents]} />
  </div>
</section>
