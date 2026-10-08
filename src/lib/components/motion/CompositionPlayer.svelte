<script lang="ts">
  import MotionPreview from './MotionPreview.svelte';
  import { Target, composeHtml } from '$lib/motion/hyperframes/compose';
  import { FEEGA_TOKENS, type BrandTokens } from '$lib/motion/brand';
  import type { MotionDoc } from '$lib/motion/doc';

  let { doc, assets, tokens = FEEGA_TOKENS, active = true, restFrame = 0 }: { doc: MotionDoc; assets: Record<string, string>; tokens?: BrandTokens; active?: boolean; restFrame?: number } = $props();

  let frame = $state(restFrame);
  let playing = $state(false);

  const html = $derived(composeHtml({ doc, tokens, assets, target: Target.Screen }));
  const last = $derived(doc.durationInFrames - 1);

  $effect(() => {
    if (!active) {
      playing = false;
      frame = restFrame;
      return;
    }
    if (playing) {
      return;
    }
    if (frame >= last) {
      frame = 0;
    }
    playing = true;
  });
</script>

<div class="composition-player">
  <MotionPreview {html} width={doc.width} height={doc.height} fps={doc.fps} bind:frame bind:playing />
</div>

<style>
  .composition-player {
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
