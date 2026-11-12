<script lang="ts">
  import { CODE_VIDEO } from '../home';
  import { lazyPlay } from '../lazy-video';
  import { MOTION, MOTION_STEPS } from '../motion';
  import { Side } from '../chapters';
  import Chapter from '../chapters/Chapter.svelte';
  import MotionLoop from '../motion/MotionLoop.svelte';
  import MotionStepGlyph from '../motion/MotionStepGlyph.svelte';
  import ProofPair from './ProofPair.svelte';
  import Ticker from './Ticker.svelte';
  import Features from './Features.svelte';
  import { Card } from './card';
  import Remotion from './Remotion.svelte';
</script>

<section class="chapter-block site-wide" id="motion">
  <Chapter copy={MOTION} steps={MOTION_STEPS} side={Side.Left} number="02">
    {#snippet art()}<MotionLoop />{/snippet}
    {#snippet glyph(g)}<MotionStepGlyph glyph={g} />{/snippet}
  </Chapter>

  <div class="proof">
    <Ticker />

    <ProofPair eyebrow="Warning - Only for real nerds" heading="Ship it as video or code." text="MP4 in every format, or React, Svelte and HTML." flip>
      {#snippet media()}
        <video data-src={CODE_VIDEO} poster="/site/home/code-poster.webp" muted loop playsinline preload="none" width="1920" height="1080" aria-label="Exporting a Feega design to code" use:lazyPlay></video>
      {/snippet}
    </ProofPair>

    <Features cards={[Card.Templates]}>
      <Remotion />
    </Features>
  </div>
</section>
