<script lang="ts">
  import { CoachStep, type CoachChain } from '$lib/onboarding/coach';
  import { COACH_STEPS, COACH_STEP_COUNT } from '$lib/onboarding/coach-steps';

  let {
    step,
    chain,
    busy = false,
    onrun,
    ongenerate,
    ondismiss
  }: {
    step: CoachStep;
    chain: CoachChain;
    busy?: boolean;
    onrun: () => void;
    ongenerate: () => void;
    ondismiss: () => void;
  } = $props();

  const LOCATE_INTERVAL_MS = 250;
  const RING_PAD_PX = 4;

  const spec = $derived(COACH_STEPS[step]);
  let ring = $state<{ x: number; y: number; width: number; height: number } | null>(null);

  $effect(() => {
    const locate = spec.locate;
    const current = chain;
    if (!locate) {
      ring = null;
      return;
    }

    const place = () => {
      const box = locate(document, current)?.getBoundingClientRect();
      ring = box && box.width > 0 ? { x: box.x, y: box.y, width: box.width, height: box.height } : null;
    };
    place();
    const timer = setInterval(place, LOCATE_INTERVAL_MS);
    return () => clearInterval(timer);
  });
</script>

{#if ring}
  <div
    class="coach-ring"
    aria-hidden="true"
    style:left="{ring.x - RING_PAD_PX}px"
    style:top="{ring.y - RING_PAD_PX}px"
    style:width="{ring.width + RING_PAD_PX * 2}px"
    style:height="{ring.height + RING_PAD_PX * 2}px"
  ></div>
{/if}

<section class="coach" aria-label="Getting started" data-testid="onboarding-coach">
  <header class="coach-head">
    <span class="coach-count">Step {spec.number} of {COACH_STEP_COUNT}</span>
    <button type="button" class="coach-skip" onclick={ondismiss}>Skip</button>
  </header>
  <h2 class="coach-title">{spec.title}</h2>
  <p class="coach-body">{spec.body}</p>

  {#if step === CoachStep.Run}
    <button type="button" class="coach-cta" disabled={busy} onclick={onrun}>Run</button>
  {:else if step === CoachStep.Generate}
    <button type="button" class="coach-cta" disabled={busy} onclick={ongenerate}>Now generate your own</button>
  {/if}
</section>

<style>
  .coach {
    position: fixed;
    left: 16px;
    bottom: 88px;
    z-index: 50;
    width: min(320px, calc(100vw - 32px));
    padding: 14px 16px 16px;
    background: var(--paper, #fff);
    border: 1px solid var(--line, #e5e5e5);
    box-shadow: 0 12px 32px -14px rgb(0 0 0 / 0.3);
  }
  .coach-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .coach-count {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-soft, #6e6e73);
  }
  .coach-skip {
    min-height: 32px;
    padding: 0 8px;
    font-size: 12px;
    color: var(--ink-soft, #6e6e73);
    background: none;
    border: 0;
    cursor: pointer;
  }
  .coach-title {
    margin: 6px 0 4px;
    font-size: 15px;
    font-weight: 600;
    color: var(--ink, #1d1d1f);
  }
  .coach-body {
    margin: 0;
    font-size: 13px;
    line-height: 1.45;
    color: var(--ink-soft, #6e6e73);
  }
  .coach-cta {
    margin-top: 12px;
    width: 100%;
    min-height: 40px;
    font-size: 13px;
    font-weight: 600;
    color: var(--paper, #fff);
    background: var(--accent-ink, #6d28d9);
    border: 0;
    cursor: pointer;
  }
  .coach-cta:disabled {
    opacity: 0.6;
    cursor: progress;
  }
  .coach-ring {
    position: fixed;
    z-index: 49;
    pointer-events: none;
    outline: 2px solid var(--accent-ink, #6d28d9);
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent-ink, #6d28d9) 25%, transparent);
    animation: coach-pulse 1.4s ease-in-out infinite;
  }
  @keyframes coach-pulse {
    50% {
      box-shadow: 0 0 0 10px color-mix(in srgb, var(--accent-ink, #6d28d9) 10%, transparent);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .coach-ring {
      animation: none;
    }
  }
</style>
