<script lang="ts">
  import { untrack } from 'svelte';
  import type { BrandTokens } from '$lib/motion/brand';
  import type { MotionDoc } from '$lib/motion/doc';
  import { drawFrame, prepare, type Prepared } from '$lib/motion/gpu-full/display-list';
  import { createRaster, type Raster } from '$lib/motion/gpu-full/raster';
  import { createMedia } from '$lib/motion/gpu-full/media';

  let { doc, tokens, assets, time, onfallback }: { doc: MotionDoc; tokens: BrandTokens; assets: Record<string, string>; time: () => number; onfallback: (reason: unknown) => void } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  let gaps = $state(0);
  const prepared = $derived(prepare(doc, tokens, assets));

  $effect(() => {
    const target = canvas;
    if (!target) {
      return;
    }
    let raster: Raster;
    try {
      raster = untrack(() => createRaster(target, doc.width, doc.height));
    } catch (e) {
      onfallback(e);
      return;
    }
    const media = createMedia();
    let drawn: [Prepared | null, number] = [null, -1];
    let busy = false;
    let loop = 0;
    const tick = () => {
      loop = requestAnimationFrame(tick);
      const now = prepared;
      const frame = Math.round(time() * now.doc.fps);
      if (busy || (drawn[0] === now && drawn[1] === frame)) {
        return;
      }
      drawn = [now, frame];
      const list = drawFrame(now, frame);
      gaps = list.unsupported.length;
      busy = true;
      void media.ready(list).then(() => {
        busy = false;
        raster.draw(list, media.pictures);
      });
    };
    loop = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(loop);
      raster.dispose();
      media.dispose();
    };
  });
</script>

<canvas class="gpu-full" bind:this={canvas} data-testid="gpu-full-canvas" data-unsupported={gaps}></canvas>

<style>
  .gpu-full {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
