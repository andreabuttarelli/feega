<script lang="ts">
  import { MOTION, MOTION_STEPS } from '../motion';
  import { Side } from '../chapters';
  import Chapter from '../chapters/Chapter.svelte';
  import MotionLoop from '../motion/MotionLoop.svelte';
  import MotionStepGlyph from '../motion/MotionStepGlyph.svelte';
  import Ticker from './Ticker.svelte';
  import Features from './Features.svelte';
  import { Card } from './card';
</script>

<section class="chapter-block site-wide" id="motion">
  <Chapter copy={MOTION} steps={MOTION_STEPS} side={Side.Left} number="02">
    {#snippet art()}<MotionLoop />{/snippet}
    {#snippet glyph(g)}<MotionStepGlyph glyph={g} />{/snippet}
  </Chapter>

  <div class="proof">
    <Ticker />

    <Features cards={[Card.Templates]} />
  </div>
</section>
