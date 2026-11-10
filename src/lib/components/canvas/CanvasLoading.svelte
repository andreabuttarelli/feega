<script lang="ts">
  import { onMount } from 'svelte';
  import { STARTUP_EVENT, StartupStep, startupMarks } from '$lib/canvas/core/startup-marks';
  import { CanvasContent, startupProgress } from '$lib/canvas/core/startup-progress';

  let { content }: { content: CanvasContent } = $props();

  const GIVE_UP_MS = 10_000;

  let done = $state(new Set<StartupStep>());
  let gaveUp = $state(false);
  const progress = $derived(startupProgress(done, content));
  const shown = $derived(progress < 1 && !gaveUp);

  onMount(() => {
    done = new Set(startupMarks(performance.getEntriesByType('mark')).map((m) => m.step));
    const reached = (e: Event) => (done = new Set([...done, (e as CustomEvent<StartupStep>).detail]));
    const timer = setTimeout(() => (gaveUp = true), GIVE_UP_MS);
    window.addEventListener(STARTUP_EVENT, reached);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(STARTUP_EVENT, reached);
    };
  });
</script>

<div class="loading" class:gone={!shown} role="progressbar" aria-label="Loading canvas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} data-testid="canvas-loading">
  <img src="/favicon-48.png" alt="" width="40" height="40" />
  <span class="word">Feega</span>
  <div class="track"><div class="bar" style:transform="scaleX({progress})"></div></div>
</div>

<style>
  .loading {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: var(--paper, #fff);
    transition: opacity 240ms ease-out;
  }

  .gone {
    opacity: 0;
    pointer-events: none;
  }

  .word {
    font-size: 20px;
    font-weight: 600;
    letter-spacing: -0.04em;
    color: var(--ink, #111);
  }

  .track {
    width: 160px;
    height: 3px;
    border-radius: 9999px;
    overflow: hidden;
    background: color-mix(in srgb, var(--ink, #111) 10%, transparent);
  }

  .bar {
    height: 100%;
    background: var(--ink, #111);
    transform-origin: left;
    transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
  }
</style>
