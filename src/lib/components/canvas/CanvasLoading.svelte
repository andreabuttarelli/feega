<script lang="ts">
  import { onMount } from 'svelte';
  import { PRIDE_FLAGS, flagGradient, nextFlag } from '$lib/canvas/pride-flags';
  import Wordmark from '$lib/components/app/Wordmark.svelte';
  import FeegaMark from '$lib/components/FeegaMark.svelte';
  import { FRAMES_SHOWN_EVENT, STARTUP_EVENT, StartupStep, startupMarks } from '$lib/canvas/core/startup-marks';
  import { CanvasContent, revealDue, startupProgress, type FramesShown } from '$lib/canvas/core/startup-progress';

  let { content }: { content: CanvasContent } = $props();

  const STATIC_SPLASH = 'canvas-splash';
  const CHECK_MS = 200;

  let gradient = $state(flagGradient(PRIDE_FLAGS[0].stripes));
  let done = $state(new Set<StartupStep>());
  let frames = $state<FramesShown>({ shown: 0, total: 0 });
  let gaveUp = $state(false);
  const progress = $derived(startupProgress(done, frames, content));
  const shown = $derived(progress < 1 && !gaveUp);
  const FADE_MS = 240;
  const MARK_SIZE = 48;
  let removed = $state(false);

  $effect(() => {
    if (shown) {
      return;
    }
    const timer = setTimeout(() => (removed = true), FADE_MS);
    return () => clearTimeout(timer);
  });

  onMount(() => {
    document.getElementById(STATIC_SPLASH)?.remove();
    try {
      gradient = flagGradient(nextFlag(localStorage).stripes);
    } catch {
      gradient = flagGradient(nextFlag({ getItem: () => null, setItem: () => undefined }).stripes);
    }
    const marks = startupMarks(performance.getEntriesByType('mark'));
    done = new Set(marks.map((m) => m.step));
    let engineAt = marks.find((m) => m.step === StartupStep.GpuReady)?.at ?? null;
    const reached = (e: Event) => {
      const step = (e as CustomEvent<StartupStep>).detail;
      done = new Set([...done, step]);
      if (step === StartupStep.GpuReady) {
        engineAt ??= performance.now();
      }
    };
    const framesShown = (e: Event) => (frames = (e as CustomEvent<FramesShown>).detail);
    const check = setInterval(() => {
      const now = performance.now();
      gaveUp = revealDue({ sinceStartMs: now, sinceEngineMs: engineAt === null ? null : now - engineAt });
    }, CHECK_MS);
    window.addEventListener(STARTUP_EVENT, reached);
    window.addEventListener(FRAMES_SHOWN_EVENT, framesShown);
    return () => {
      clearInterval(check);
      window.removeEventListener(STARTUP_EVENT, reached);
      window.removeEventListener(FRAMES_SHOWN_EVENT, framesShown);
    };
  });
</script>

{#if !removed}
  <div class="loading" class:gone={!shown} role="progressbar" aria-label="Loading canvas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} data-testid="canvas-loading" style:--fade-ms={FADE_MS}>
    <FeegaMark size={MARK_SIZE} />
    <span class="mark"><Wordmark /></span>
    <div class="track"><div class="bar" style:background={gradient} style:clip-path="inset(0 {(1 - progress) * 100}% 0 0)"></div></div>
  </div>
{/if}

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
    transition: opacity calc(var(--fade-ms) * 1ms) ease-out;
  }

  .gone {
    opacity: 0;
    pointer-events: none;
  }

  .mark {
    --wordmark-size: 40px;
    line-height: 1;
  }

  .track {
    width: 180px;
    height: 4px;
    border-radius: var(--ui-radius-full);
    overflow: hidden;
    background: color-mix(in srgb, var(--ink, #111) 10%, transparent);
  }

  .bar {
    height: 100%;
    transition: clip-path 300ms cubic-bezier(0.16, 1, 0.3, 1);
  }
</style>
