<script lang="ts">
  import { CLIP, IMAGE, MAX_SEATS, count, estimate, money, seatCost, type CloudPlan } from './plan';

  let { plan }: { plan: CloudPlan } = $props();

  const SLIDERS = [
    { id: 'est-images', outcome: IMAGE, max: 600, step: 10 },
    { id: 'est-clips', outcome: CLIP, max: 60, step: 1 }
  ];

  let counts = $state([100, 5]);
  let editors = $state(1);

  const clampEditors = (n: number) => Math.min(MAX_SEATS, Math.max(1, Math.round(n) || 1));
  const setEditors = (n: number) => {
    editors = clampEditors(n);
  };

  const typed = (input: HTMLInputElement) => {
    if (Number.isFinite(input.valueAsNumber)) {
      setEditors(input.valueAsNumber);
    }
  };

  const settle = (input: HTMLInputElement) => {
    setEditors(input.valueAsNumber);
    input.value = String(editors);
  };

  const result = $derived(estimate(plan, editors, counts[0], counts[1]));
</script>

<div class="estimator" role="group" aria-labelledby="estimator-title">
  <h3 id="estimator-title">What will I use?</h3>
  <p class="hint">Set your month. Estimates use the models' own prices plus 20%.</p>

  <div class="seats">
    <label for="est-seats">{plan.per}s</label>
    <div class="stepper">
      <button type="button" aria-label="One {plan.per} fewer" disabled={editors <= 1} onclick={() => setEditors(editors - 1)}>−</button>
      <input id="est-seats" type="number" inputmode="numeric" min="1" max={MAX_SEATS} value={editors} oninput={(e) => typed(e.currentTarget)} onchange={(e) => settle(e.currentTarget)} />
      <button type="button" aria-label="One {plan.per} more" disabled={editors >= MAX_SEATS} onclick={() => setEditors(editors + 1)}>+</button>
    </div>
  </div>

  <div class="sliders">
    {#each SLIDERS as slider, i (slider.id)}
      <div class="slider">
        <label class="row" for={slider.id}><span>{slider.outcome.label}</span><output for={slider.id}>{counts[i]}</output></label>
        <input id={slider.id} type="range" min="0" max={slider.max} step={slider.step} bind:value={counts[i]} />
      </div>
    {/each}
  </div>

  <p class="verdict" aria-live="polite">
    About <strong>{count(result.credits)} credits</strong> a {plan.period}.
    {seatCost(plan, editors, result.cost, result.included)}
    {#if result.topUps.length}
      You'd top up about <strong>{count(result.gap)} credits</strong>: {result.topUps.map((t) => money(plan, t.price)).join(' + ')} covers it.
    {:else}
      That fits.
    {/if}
  </p>
</div>

<style>
  .estimator {
    display: grid;
    gap: 24px;
    margin-top: 64px;
    padding: 28px 24px;
    border-radius: 10px;
    background: #000;
  }

  h3,
  p {
    margin: 0;
  }

  h3 {
    font-size: 26px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .hint {
    margin-top: -14px;
    opacity: 0.7;
  }

  .seats {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }

  .seats label::first-letter {
    text-transform: uppercase;
  }

  .seats label {
    display: block;
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .stepper button {
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 50%;
    background: #222;
    color: #fff;
    font: inherit;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
  }

  .stepper button:hover:not(:disabled) {
    background: #333;
  }

  .stepper button:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .stepper input {
    width: 56px;
    height: 36px;
    border: 1px solid #444;
    border-radius: 4px;
    background: transparent;
    color: #fff;
    font: inherit;
    text-align: center;
    font-variant-numeric: tabular-nums;
    appearance: textfield;
  }

  .stepper input::-webkit-inner-spin-button,
  .stepper input::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .stepper :is(button, input):focus-visible {
    outline: 2px solid #ff5100;
    outline-offset: 3px;
  }

  .sliders {
    display: grid;
    gap: 24px;
  }

  .slider {
    display: grid;
    gap: 8px;
  }

  .row {
    display: flex;
    justify-content: space-between;
  }

  output {
    min-width: 3ch;
    text-align: right;
    font-variant-numeric: tabular-nums;
    color: #fff;
  }

  input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 32px;
    margin: 0;
    background: transparent;
    cursor: pointer;
  }

  input[type='range']::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 2px;
    background: #444;
  }

  input[type='range']::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background: #444;
  }

  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 24px;
    height: 24px;
    margin-top: -10px;
    border-radius: 50%;
    background: #ff5100;
  }

  input[type='range']::-moz-range-thumb {
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: 50%;
    background: #ff5100;
  }

  input[type='range']:focus-visible {
    outline: 2px solid #ff5100;
    outline-offset: 4px;
    border-radius: 4px;
  }

  input[type='range']:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 4px rgba(255, 81, 0, 0.35);
  }

  .verdict {
    padding-top: 20px;
    border-top: 1px solid rgba(240, 238, 233, 0.15);
    font-size: 20px;
    line-height: 1.35;
  }

  strong {
    font-weight: inherit;
    color: #ff5100;
  }

  @media (min-width: 810px) {
    .estimator {
      padding: 40px;
    }

    .sliders {
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }
  }

  @media (min-width: 1200px) {
    .estimator {
      padding: 48px;
    }

    h3 {
      font-size: 30px;
    }

    .verdict {
      font-size: 22px;
    }
  }
</style>
