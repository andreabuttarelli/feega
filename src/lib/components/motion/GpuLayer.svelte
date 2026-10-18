<script lang="ts">
  import { onMount } from 'svelte';
  import type { Compose, GpuEngine } from '$lib/motion/gpu/engine';

  const gpu = () => import('$lib/motion/gpu/engine');
  const OFFSTAGE = 'position:fixed;left:-20000px;top:0;width:1920px;height:1080px;pointer-events:none';

  let { html, compose, time, onfallback }: { html: string; compose: Compose; time: () => number; onfallback: (reason: unknown) => void } = $props();

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
    const running = engine;
    void gpu()
      .then(({ Freshness }) => running.renderAt(time(), Freshness.Latest))
      .finally(() => {
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
    const offstage = document.body.appendChild(Object.assign(document.createElement('div'), { style: OFFSTAGE }));
    void gpu().then(({ gpuEngine }) => gpuEngine(source, offstage, undefined, target.clientWidth || null)).then((next) => {
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
      engine?.dispose();
      engine = null;
      offstage.remove();
    };
  });

  onMount(() => () => {
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
