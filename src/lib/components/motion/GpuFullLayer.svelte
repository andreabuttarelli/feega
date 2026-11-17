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
  import { stripsFor } from '@feega/motion-core/motion/gpu-full/strips';

  let { backend, doc, tokens, assets, analyses, compose, time, onfallback }: { backend: FullBackend; doc: MotionDoc; tokens: BrandTokens; assets: Record<string, string>; analyses?: Record<string, AudioAnalysis>; compose: Compose; time: () => number; onfallback: (reason: unknown) => void } = $props();

  const strips = $derived(stripsFor(backend, { width: doc.width, height: doc.height }));
  let canvases = $state<HTMLCanvasElement[]>([]);
  let host = $state<HTMLDivElement | null>(null);
  let gaps = $state(0);
  let player = $state.raw<Player | null>(null);

  $effect(() => {
    const placed = untrack(() => strips).map((strip, i) => ({ canvas: canvases[i], strip }));
    const frameHost = host;
    if (placed.some((p) => !p.canvas) || !frameHost) {
      return;
    }
    const made = untrack(() => mountPlayer({ canvases: placed, host: frameHost, backend, size: { width: doc.width, height: doc.height }, time, faces: new URLSearchParams(location.search).get(FACES_PARAM), onfallback, ongaps: (n) => (gaps = n), frames: sharedFrames() }));
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
{#each strips as strip, i (strip.top)}
  <canvas class="gpu-full" bind:this={canvases[i]} style:top={`${(strip.top / doc.height) * 100}%`} style:height={`${(strip.height / doc.height) * 100}%`} data-testid="gpu-full-canvas" data-unsupported={gaps}></canvas>
{/each}

<style>
  .gpu-full-reads {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .gpu-full {
    position: absolute;
    left: 0;
    width: 100%;
    pointer-events: none;
  }
</style>
