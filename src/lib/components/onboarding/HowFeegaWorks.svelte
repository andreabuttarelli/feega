<script lang="ts">
  import { onMount, tick } from 'svelte';
    import { track } from '$lib/analytics';
  import { MAKE_VIDEO_PATH, TOUR_SLIDES, TourEvent, TourScene, opensOnArrival, type TourState } from '$lib/onboarding/tour';
  import { tourDialog } from '$lib/onboarding/tour-dialog.svelte';
  import { rememberTourSeen, seenInBrowser } from '$lib/onboarding/tour-memory';
  import TourStage from './TourStage.svelte';

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
      <TourStage scene={slide.id} />

      <button type="button" class="skip" onclick={() => close(TourEvent.Skip)} data-testid="tour-skip">Skip</button>

      <div class="panel" class:finale={last}>
        {#key slide.id}
          <div class="copy">
            <h2 id="tour-title">{slide.title}</h2>
            <p>{slide.body}</p>
          </div>
        {/key}

        <div class="controls">
          <div class="dots" role="tablist" aria-label="Slides">
            {#each TOUR_SLIDES as s, i (s.id)}
              <button type="button" role="tab" class="dot" aria-selected={i === index} aria-label="Slide {i + 1} of {TOUR_SLIDES.length}" onclick={() => go(i)}></button>
            {/each}
          </div>

          <div class="arrows">
            {#if index > 0}<button type="button" class="ghost" onclick={() => go(index - 1)}>Back</button>{/if}
            {#if last}
              <form method="POST" action="/app?/project" onsubmit={() => close(TourEvent.Finish)}>
                <button type="submit" class="secondary" data-testid="tour-open-canvas">Open a canvas</button>
              </form>
              <a class="primary" href={MAKE_VIDEO_PATH} onclick={() => close(TourEvent.Finish)} data-testid="tour-make-video">Make a video</a>
            {:else}
              <button type="button" class="primary" onclick={() => go(index + 1)} data-testid="tour-next">Next</button>
            {/if}
          </div>
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
    padding: 24px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(6px);
    animation: fade 400ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .tour {
    position: relative;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    grid-template-columns: minmax(0, 1fr);
    width: min(1360px, 100%);
    height: min(880px, 100%);
    overflow: hidden;
    background: var(--ui-panel, #fff);
    color: var(--ui-text, #111);
    font-family: var(--ui-sans, 'DM Sans', system-ui, sans-serif);
    outline: none;
    box-shadow: 0 60px 120px -40px rgba(0, 0, 0, 0.6);
    animation: enter 600ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .skip {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 1;
    min-height: 44px;
    padding: 0 20px;
    border: 0;
    border-radius: var(--ui-radius-full);
    background: color-mix(in srgb, var(--ui-panel, #fff) 80%, transparent);
    backdrop-filter: blur(8px);
    color: var(--ui-text-secondary, #5c5c58);
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }

  .skip:hover {
    color: var(--ui-text, #111);
  }

  .panel {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: 48px;
    padding: 36px 40px 40px;
  }

  .copy {
    display: flex;
    flex-direction: column;
    gap: 14px;
    animation: copy 700ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  h2 {
    margin: 0;
    font-size: clamp(40px, 4.5vw, 72px);
    font-weight: 600;
    letter-spacing: -0.045em;
    line-height: 0.95;
    text-transform: lowercase;
  }

  p {
    max-width: 560px;
    margin: 0;
    font-size: 17px;
    line-height: 1.45;
    color: var(--ui-text-secondary, #5c5c58);
  }

  .controls {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 16px;
  }

  .dots {
    display: flex;
  }

  .dot {
    width: 22px;
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
    background: color-mix(in srgb, var(--ui-text, #111) 20%, transparent);
    transition: transform 400ms cubic-bezier(0.16, 1, 0.3, 1), background 200ms;
  }

  .dot[aria-selected='true']::before {
    background: var(--ui-accent, #0099ff);
    transform: scale(1.4);
  }

  .arrows {
    display: flex;
    gap: 8px;
  }

  .arrows form {
    display: contents;
  }

  .primary,
  .secondary,
  .ghost {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    padding: 0 26px;
    border: 0;
    border-radius: var(--ui-radius-full);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;
  }

  .primary {
    background: var(--ui-accent, #0099ff);
    color: var(--ui-accent-ink, #fff);
  }

  .secondary {
    background: var(--ui-wash, #f2f2ef);
    color: var(--ui-text, #111);
  }

  .ghost {
    background: transparent;
    color: var(--ui-text-secondary, #5c5c58);
  }

  .primary:focus-visible,
  .secondary:focus-visible,
  .ghost:focus-visible,
  .dot:focus-visible,
  .skip:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring, 0 0 0 2px #0099ff);
  }

  @keyframes fade {
    from { opacity: 0; }
  }

  @keyframes enter {
    from { opacity: 0; transform: translateY(24px) scale(0.98); }
  }

  @keyframes copy {
    from { opacity: 0; transform: translateY(16px); }
  }

  @media (max-width: 640px) {
    .tour-backdrop {
      padding: 0;
    }

    .tour {
      width: 100vw;
      height: 100dvh;
      grid-template-rows: minmax(0, 1fr) auto;
    }

    .panel {
      grid-template-columns: minmax(0, 1fr);
      gap: 20px;
      padding: 24px 16px calc(16px + env(safe-area-inset-bottom));
    }

    h2 {
      font-size: clamp(36px, 10vw, 64px);
    }

    p {
      font-size: 15px;
    }

    .controls {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
    }

    .finale .controls {
      flex-direction: column;
      align-items: stretch;
    }

    .finale .ghost {
      display: none;
    }

    .finale .arrows .primary,
    .finale .arrows .secondary {
      flex: 1;
    }

    .primary,
    .secondary {
      padding: 0 18px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tour-backdrop,
    .tour,
    .copy {
      animation: none;
    }
  }
</style>
