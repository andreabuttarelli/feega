<script lang="ts">
  import { SLIDER_MAX } from '$lib/gallery/model';

  let { min, max, onchange }: { min: number; max: number; onchange: (range: { min: number; max: number }) => void } = $props();

  let low = $state(0);
  let high = $state(SLIDER_MAX);

  $effect.pre(() => {
    low = min;
    high = max;
  });

  const label = $derived(`${low}–${high >= SLIDER_MAX ? `${SLIDER_MAX}+` : high} s`);
  const left = $derived((low / SLIDER_MAX) * 100);
  const right = $derived(100 - (high / SLIDER_MAX) * 100);

  function moveLow(value: number) {
    low = Math.min(value, high);
  }

  function moveHigh(value: number) {
    high = Math.max(value, low);
  }

  const commit = () => onchange({ min: low, max: high });
</script>

<div class="range" data-testid="duration-range">
  <span class="label">Length</span>
  <div class="track">
    <span class="rail"></span>
    <span class="fill" style={`left: ${left}%; right: ${right}%;`}></span>
    <input type="range" min="0" max={SLIDER_MAX} step="1" value={low} aria-label="Shortest length in seconds" aria-valuetext={`${low} seconds`} oninput={(e) => moveLow(Number(e.currentTarget.value))} onchange={commit} />
    <input type="range" min="0" max={SLIDER_MAX} step="1" value={high} aria-label="Longest length in seconds" aria-valuetext={high >= SLIDER_MAX ? 'no limit' : `${high} seconds`} oninput={(e) => moveHigh(Number(e.currentTarget.value))} onchange={commit} />
  </div>
  <output class="value">{label}</output>
</div>

<style>
  .range {
    display: inline-flex;
    align-items: center;
    gap: var(--ui-space-3);
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-3);
  }

  .track {
    position: relative;
    width: 140px;
    height: 20px;
  }

  .rail,
  .fill {
    position: absolute;
    top: 50%;
    height: 2px;
    transform: translateY(-50%);
  }

  .rail {
    left: 0;
    right: 0;
    background: var(--ui-line-strong);
  }

  .fill {
    background: var(--ui-ink);
  }

  input {
    position: absolute;
    inset: 0;
    width: 100%;
    margin: 0;
    background: none;
    pointer-events: none;
    appearance: none;
    -webkit-appearance: none;
  }

  input::-webkit-slider-thumb {
    width: 12px;
    height: 12px;
    border: 0;
    background: var(--ui-ink);
    pointer-events: auto;
    cursor: grab;
    -webkit-appearance: none;
    transition: transform 120ms ease;
  }

  input::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border: 0;
    border-radius: 0;
    background: var(--ui-ink);
    pointer-events: auto;
    cursor: grab;
  }

  input:active::-webkit-slider-thumb {
    transform: scale(1.2);
    cursor: grabbing;
  }

  input:focus-visible {
    outline: none;
  }

  input:focus-visible::-webkit-slider-thumb {
    box-shadow: var(--ui-focus);
  }

  .value {
    min-width: 52px;
    color: var(--ui-ink-2);
    font-variant-numeric: tabular-nums;
  }

  @media (max-width: 640px) {
    .range {
      width: 100%;
    }

    .track {
      flex: 1;
      height: 32px;
    }

    input::-webkit-slider-thumb {
      width: 16px;
      height: 16px;
    }
  }
</style>
