<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Freshness, gpuEngine, type Compose, type GpuEngine } from '$lib/motion/gpu/engine';

  let { html, compose, time, onfallback }: { html: string; compose: Compose; time: () => number; onfallback: () => void } = $props();

  let host = $state<HTMLDivElement | null>(null);
  let engine: GpuEngine | null = null;
  let loop = 0;
  let busy = false;

  function tick() {
    loop = requestAnimationFrame(tick);
    if (!engine || busy) {
      return;
    }
    busy = true;
    void engine.renderAt(time(), Freshness.Latest).finally(() => {
      busy = false;
    });
  }

  $effect(() => {
    void html;
    const source = compose;
    const target = host;
    if (!target) {
      return;
    }
    let cancelled = false;
    void gpuEngine(source, target).then((next) => {
      if (cancelled) {
        next.dispose();
        return;
      }
      engine?.dispose();
      engine = next;
      next.canvas.dataset.testid = 'gpu-motion-canvas';
      next.canvas.dataset.backend = next.backend;
      next.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
      target.appendChild(next.canvas);
    }, onfallback);
    cancelAnimationFrame(loop);
    loop = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
    };
  });

  onDestroy(() => {
    cancelAnimationFrame(loop);
    engine?.dispose();
  });
</script>

<div class="gpu" bind:this={host}></div>

<style>
  .gpu {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
</style>
