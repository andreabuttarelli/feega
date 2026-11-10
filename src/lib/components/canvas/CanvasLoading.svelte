<script lang="ts">
  import { onMount } from 'svelte';
  import { PRIDE_FLAGS, flagGradient, nextFlag } from '$lib/canvas/pride-flags';
  import Wordmark from '$lib/components/app/Wordmark.svelte';
  import { STARTUP_EVENT, StartupStep, startupMarks } from '$lib/canvas/core/startup-marks';
  import { CanvasContent, startupProgress } from '$lib/canvas/core/startup-progress';

  let { content }: { content: CanvasContent } = $props();

  const GIVE_UP_MS = 10_000;
  const AFTER_BUILT_MS = 1500;

  let gradient = $state(flagGradient(PRIDE_FLAGS[0].stripes));
  let done = $state(new Set<StartupStep>());
  let gaveUp = $state(false);
  const progress = $derived(startupProgress(done, content));
  const shown = $derived(progress < 1 && !gaveUp);

  onMount(() => {
    try {
      gradient = flagGradient(nextFlag(localStorage).stripes);
    } catch {
      gradient = flagGradient(nextFlag({ getItem: () => null, setItem: () => undefined }).stripes);
    }
    done = new Set(startupMarks(performance.getEntriesByType('mark')).map((m) => m.step));
    const reached = (e: Event) => (done = new Set([...done, (e as CustomEvent<StartupStep>).detail]));
    const timer = setTimeout(() => (gaveUp = true), GIVE_UP_MS);
    let settle: ReturnType<typeof setTimeout> | undefined;
    const built = (e: Event) => {
      if ((e as CustomEvent<StartupStep>).detail === StartupStep.FirstBuilt) {
        settle = setTimeout(() => (gaveUp = true), AFTER_BUILT_MS);
      }
    };
    window.addEventListener(STARTUP_EVENT, built);
    window.addEventListener(STARTUP_EVENT, reached);
    return () => {
      clearTimeout(timer);
      clearTimeout(settle);
      window.removeEventListener(STARTUP_EVENT, built);
      window.removeEventListener(STARTUP_EVENT, reached);
    };
  });
</script>

<div class="loading" class:gone={!shown} role="progressbar" aria-label="Loading canvas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} data-testid="canvas-loading">
  <span class="mark"><Wordmark /></span>
  <div class="track"><div class="bar" style:background={gradient} style:clip-path="inset(0 {(1 - progress) * 100}% 0 0)"></div></div>
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

  .mark {
    --wordmark-size: 40px;
  }

  .track {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    overflow: hidden;
    background: color-mix(in srgb, var(--ink, #111) 10%, transparent);
  }

  .bar {
    height: 100%;
    transition: clip-path 300ms cubic-bezier(0.16, 1, 0.3, 1);
  }
</style>
