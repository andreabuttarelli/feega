<script lang="ts">
  import { onMount, tick } from 'svelte';
  import X from '@lucide/svelte/icons/x';
  import { track } from '$lib/analytics';
  import { MAKE_VIDEO_PATH, TOUR_SLIDES, TourEvent, TourScene, opensOnArrival, type TourState } from '$lib/onboarding/tour';
  import { tourDialog } from '$lib/onboarding/tour-dialog.svelte';
  import { rememberTourSeen, seenInBrowser } from '$lib/onboarding/tour-memory';
  import TourIllustration from './TourIllustration.svelte';

  let { tour }: { tour: TourState } = $props();

  let index = $state(0);
  let dialog = $state<HTMLElement | null>(null);

  const slide = $derived(TOUR_SLIDES[index]);
  const last = $derived(index === TOUR_SLIDES.length - 1);

  onMount(() => {
    if (opensOnArrival(tour, seenInBrowser())) {
      tourDialog.open = true;
    }
  });

  $effect(() => {
    if (!tourDialog.open) {
      return;
    }
    track(TourEvent.Slide, { slide: slide.id, index });
  });

  $effect(() => {
    if (tourDialog.open) {
      tick().then(() => dialog?.focus());
    }
  });

  function go(to: number) {
    index = Math.max(0, Math.min(TOUR_SLIDES.length - 1, to));
  }

  function close(event: TourEvent) {
    track(event, { slide: slide.id, index });
    tourDialog.open = false;
    index = 0;
    void rememberTourSeen();
  }

  const KEYS: Record<string, () => void> = {
    ArrowRight: () => go(index + 1),
    ArrowLeft: () => go(index - 1),
    Escape: () => close(TourEvent.Skip)
  };

  function onkeydown(e: KeyboardEvent) {
    const action = tourDialog.open ? KEYS[e.key] : undefined;
    if (!action) {
      return;
    }
    e.preventDefault();
    action();
  }
</script>

<svelte:window {onkeydown} />

{#if tourDialog.open}
  <div class="tour-backdrop">
    <div class="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title" tabindex="-1" bind:this={dialog} data-testid="tour" data-slide={slide.id}>
      <button type="button" class="skip" aria-label="Skip" onclick={() => close(TourEvent.Skip)} data-testid="tour-skip">
        <X size={16} strokeWidth={1.7} />
      </button>

      <TourIllustration scene={slide.id} />

      <div class="copy">
        <span class="step">{index + 1} / {TOUR_SLIDES.length}</span>
        <h2 id="tour-title">{slide.title}</h2>
        <p>{slide.body}</p>
      </div>

      {#if slide.id === TourScene.Start}
        <div class="start">
          <a class="primary" href={MAKE_VIDEO_PATH} onclick={() => close(TourEvent.Finish)} data-testid="tour-make-video">Make a video</a>
          <form method="POST" action="/app?/project" onsubmit={() => close(TourEvent.Finish)}>
            <button type="submit" class="secondary" data-testid="tour-open-canvas">Open a canvas</button>
          </form>
        </div>
      {/if}

      <div class="tour-foot">
        <div class="dots" role="tablist" aria-label="Slides">
          {#each TOUR_SLIDES as s, i (s.id)}
            <button type="button" role="tab" class="dot" aria-selected={i === index} aria-label="Slide {i + 1}" onclick={() => go(i)}></button>
          {/each}
        </div>
        <div class="arrows">
          {#if index > 0}<button type="button" class="ghost" onclick={() => go(index - 1)}>Back</button>{/if}
          {#if !last}<button type="button" class="primary" onclick={() => go(index + 1)} data-testid="tour-next">Next</button>{/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .tour-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
  }

  .tour {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: min(560px, calc(100vw - 32px));
    max-height: calc(100dvh - 32px);
    overflow-y: auto;
    padding: 24px;
    background: var(--ui-bg, #fff);
    color: var(--ui-ink, #111);
    font-family: var(--ui-sans, 'DM Sans', system-ui, sans-serif);
    outline: none;
  }

  .skip {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 9999px;
    background: transparent;
    color: var(--ui-ink-2, #555);
    cursor: pointer;
  }

  .skip:hover {
    background: var(--ui-hover, rgba(0, 0, 0, 0.05));
  }

  .copy {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .step {
    font-family: var(--ui-mono, monospace);
    font-size: 11px;
    color: var(--ui-ink-3, #888);
  }

  h2 {
    margin: 0;
    font-size: clamp(36px, 6vw, 56px);
    font-weight: 600;
    letter-spacing: -0.04em;
    line-height: 0.95;
    text-transform: lowercase;
  }

  p {
    margin: 0;
    font-size: 15px;
    line-height: 1.45;
    color: var(--ui-ink-2, #555);
  }

  .start {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .start form {
    display: contents;
  }

  .tour-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: auto;
  }

  .dots {
    display: flex;
    gap: 2px;
  }

  .dot {
    width: 24px;
    height: 44px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }

  .dot::before {
    content: '';
    display: block;
    width: 8px;
    height: 8px;
    margin: auto;
    border-radius: 50%;
    background: var(--ui-ink-3, #ccc);
  }

  .dot[aria-selected='true']::before {
    background: var(--ui-accent, #0099ff);
  }

  .arrows {
    display: flex;
    gap: 8px;
  }

  .primary,
  .secondary,
  .ghost {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 20px;
    border: 0;
    border-radius: 9999px;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
  }

  .primary {
    background: var(--ui-accent, #0099ff);
    color: var(--ui-accent-ink, #fff);
  }

  .secondary {
    background: var(--ui-surface, #f2f2f2);
    color: var(--ui-ink, #111);
  }

  .ghost {
    background: transparent;
    color: var(--ui-ink-2, #555);
  }

  .primary:focus-visible,
  .secondary:focus-visible,
  .ghost:focus-visible,
  .dot:focus-visible,
  .skip:focus-visible {
    outline: none;
    box-shadow: var(--ui-focus, 0 0 0 2px #0099ff);
  }

  @media (max-width: 640px) {
    .tour-backdrop {
      align-items: stretch;
    }

    .tour {
      width: 100vw;
      max-height: none;
      height: 100dvh;
      padding: 56px 16px calc(16px + env(safe-area-inset-bottom));
    }
  }
</style>
