<script lang="ts">
  import { AI_MARKUP, CLIP, IMAGE, estimate, includedCredits, money, type CloudPlan } from './plan';

  let { plan }: { plan: CloudPlan } = $props();

  const SLIDERS = [
    { id: 'est-images', outcome: IMAGE, max: 600, step: 10 },
    { id: 'est-clips', outcome: CLIP, max: 60, step: 1 }
  ];

  let counts = $state([100, 5]);

  const result = $derived(estimate(plan, counts[0], counts[1]));
</script>

<div class="estimator" role="group" aria-labelledby="estimator-title">
  <h3 id="estimator-title">What will I use?</h3>
  <p class="hint">Set your month. Each run costs the model's own price plus {AI_MARKUP * 100}%.</p>

  <div class="sliders">
    {#each SLIDERS as slider, i (slider.id)}
      <div class="slider">
        <label class="row" for={slider.id}><span>{slider.outcome.label}</span><output for={slider.id}>{counts[i]}</output></label>
        <input id={slider.id} type="range" min="0" max={slider.max} step={slider.step} bind:value={counts[i]} />
      </div>
    {/each}
  </div>

  <p class="verdict" aria-live="polite">
    About <strong>{result.credits} credits</strong> a {plan.period}.
    {#if result.topUp === 0}
      Fits in the {money(plan, plan.price)} plan.
    {:else}
      The plan includes {includedCredits(plan)}, so you'd top up about <strong>{result.topUp} credits</strong>.
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
