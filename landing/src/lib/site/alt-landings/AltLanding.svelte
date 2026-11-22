<script lang="ts">
  import Hero from '../home/Hero.svelte';
  import { HeadlineSize } from '../home/headline-size';
  import OpenSource from '../home/OpenSource.svelte';
  import Codebase from '../home/Codebase.svelte';
  import FreeSection from '../home/FreeSection.svelte';
  import Closing from '../home/Closing.svelte';
  import Pricing from '../pricing/Pricing.svelte';
  import PricingFaq from '../pricing/PricingFaq.svelte';
  import { PLAN } from '../pricing/plan';
  import EditorPicture from '../EditorPicture.svelte';
  import CompareStrip from './CompareStrip.svelte';
  import Differentiators from './Differentiators.svelte';
  import type { Variant } from './variant';

  let { variant }: { variant: Variant } = $props();

  const FAQ_HEADING = 'questions from this switch';
</script>

<div class="site-home">
  <Hero headline={variant.h1} size={HeadlineSize.Compact}>
    {#snippet lead()}{variant.subhead}{/snippet}
    {#snippet art()}<EditorPicture id={variant.shot} loading="eager" />{/snippet}
  </Hero>

  <CompareStrip {variant} />
  <Differentiators {variant} />
  <OpenSource />
  <div class="chapters">
    <Codebase />
  </div>

  <section class="faq site-wide" aria-label="Questions about this switch">
    <PricingFaq items={variant.faq} heading={FAQ_HEADING} />
  </section>

  <div class="cool">
    <FreeSection />
    <Pricing plan={PLAN} />
  </div>

  <Closing />
</div>

<style>
  .site-home {
    background: linear-gradient(#161616 0%, #000 5.37446%);
  }

  .cool {
    background: var(--site-raised);
  }

  .faq {
    padding: 0 12px;
    color: var(--site-ink);
  }
</style>
