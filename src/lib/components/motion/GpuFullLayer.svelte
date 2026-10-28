<script lang="ts">
  import { untrack } from 'svelte';
  import type { BrandTokens } from '@feega/motion-core/motion/brand';
  import type { AudioAnalysis } from '@feega/motion-core/motion/audio-analysis';
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import { FACES_PARAM } from '@feega/motion-core/motion/gpu-full/text/engines';
  import type { FullBackend } from '@feega/motion-core/motion/gpu-full/backends';
  import type { Compose } from '@feega/motion-core/motion/gpu-full/dom/reader';
  import { sharedFrames } from '$lib/motion/gpu/shared-frames';
  import { mountPlayer, type Player } from '@feega/motion-core/motion/gpu-full/play';

  let { backend, doc, tokens, assets, analyses, compose, time, onfallback }: { backend: FullBackend; doc: MotionDoc; tokens: BrandTokens; assets: Record<string, string>; analyses?: Record<string, AudioAnalysis>; compose: Compose; time: () => number; onfallback: (reason: unknown) => void } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  let host = $state<HTMLDivElement | null>(null);
  let gaps = $state(0);
  let player = $state.raw<Player | null>(null);

  $effect(() => {
    const target = canvas;
    const frameHost = host;
    if (!target || !frameHost) {
      return;
    }
    const made = untrack(() => mountPlayer({ canvas: target, host: frameHost, backend, size: { width: doc.width, height: doc.height }, time, faces: new URLSearchParams(location.search).get(FACES_PARAM), onfallback, ongaps: (n) => (gaps = n), frames: sharedFrames() }));
    player = made;
    return () => {
      player = null;
      made.dispose();
    };
  });

  $effect(() => {
    player?.show({ doc, tokens, assets, analyses, compose });
  });
</script>

<div class="gpu-full-reads" bind:this={host} aria-hidden="true"></div>
<canvas class="gpu-full" bind:this={canvas} data-testid="gpu-full-canvas" data-unsupported={gaps}></canvas>

<style>
  .gpu-full-reads {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .gpu-full {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
