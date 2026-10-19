<script lang="ts">
  import { untrack } from 'svelte';
  import type { BrandTokens } from '$lib/motion/brand';
  import type { MotionDoc } from '$lib/motion/doc';
  import { drawFrame, prepare, type Prepared } from '$lib/motion/gpu-full/display-list';
  import { createRaster, type Raster } from '$lib/motion/gpu-full/raster';
  import { createMedia } from '$lib/motion/gpu-full/media';
  import { mountCustomReads, type CustomReads } from '$lib/motion/gpu-full/dom/custom';
  import type { Compose } from '$lib/motion/gpu-full/dom/reader';

  let { doc, tokens, assets, compose, time, onfallback }: { doc: MotionDoc; tokens: BrandTokens; assets: Record<string, string>; compose: Compose; time: () => number; onfallback: (reason: unknown) => void } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  let host = $state<HTMLDivElement | null>(null);
  let gaps = $state(0);
  const prepared = $derived(prepare(doc, tokens, assets));
  let reads = $state.raw<{ of: Prepared; custom: Promise<CustomReads> } | null>(null);

  $effect(() => {
    const frameHost = host;
    const of = prepared;
    if (!frameHost) {
      return;
    }
    const custom = untrack(() => mountCustomReads(frameHost, compose, of));
    reads = { of, custom };
    return () => void custom.then((r) => r.dispose(), () => {});
  });

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
      const current = reads;
      const now = current?.of;
      if (!current || !now) {
        return;
      }
      const frame = Math.round(time() * now.doc.fps);
      if (busy || (drawn[0] === now && drawn[1] === frame)) {
        return;
      }
      drawn = [now, frame];
      busy = true;
      void current.custom
        .then((reads) => reads.readAt(frame))
        .then(async (read) => {
          const list = drawFrame(now, frame, read.reads);
          gaps = list.unsupported.length;
          await media.ready(list);
          raster.draw(list, (item) => read.picture(item) ?? media.pictures(item));
        })
        .catch(onfallback)
        .finally(() => {
          busy = false;
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
