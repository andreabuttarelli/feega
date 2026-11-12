<script lang="ts">
  import { CLIP, IMAGE, estimate, money, type CloudPlan } from './plan';

  let { plan }: { plan: CloudPlan } = $props();

  let images = $state(100);
  let clips = $state(5);

  const result = $derived(estimate(plan, images, clips));
</script>

<div class="estimator">
  <h3 id="estimator-title">What will I use?</h3>
  <p class="hint">Move the sliders to your month. Prices are the models' own plus 20%.</p>

  <div class="sliders">
    <label>
      <span class="row"><span>{IMAGE.label}</span><output>{images}</output></span>
      <input type="range" min="0" max="600" step="10" bind:value={images} />
    </label>
    <label>
      <span class="row"><span>{CLIP.label}</span><output>{clips}</output></span>
      <input type="range" min="0" max="60" step="1" bind:value={clips} />
    </label>
  </div>

  <p class="verdict" aria-live="polite">
    About <strong>{result.credits} credits</strong>.
    {#if result.extra === 0}
      Fits in the {money(plan.price)} plan.
    {:else}
      The plan covers {plan.credits}, so you'd top up about <strong>{result.extra} credits</strong>. Top-ups start at {money(plan.topUpFrom)}.
    {/if}
  </p>
</div>

<style>
  .estimator {
    display: grid;
    gap: 20px;
    margin-top: 16px;
    padding: 28px 24px;
    border-radius: 10px;
    background: #000;
  }

  h3,
  p {
    margin: 0;
  }

  h3 {
    font-size: 24px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .hint {
    margin-top: -12px;
    opacity: 0.6;
  }

  .sliders {
    display: grid;
    gap: 20px;
  }

  label {
    display: grid;
    gap: 8px;
  }

  .row {
    display: flex;
    justify-content: space-between;
  }

  .row span::first-letter {
    text-transform: uppercase;
  }

  .row span {
    display: block;
  }

  output {
    font-variant-numeric: tabular-nums;
    color: #fff;
  }

  input[type='range'] {
    width: 100%;
    height: 28px;
    margin: 0;
    background: transparent;
    accent-color: #ff5100;
    cursor: pointer;
  }

  input[type='range']::-webkit-slider-runnable-track {
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

  input[type='range'] {
    -webkit-appearance: none;
  }

  input[type='range']:focus-visible {
    outline: 2px solid #ff5100;
    outline-offset: 4px;
    border-radius: 4px;
  }

  .verdict {
    padding-top: 16px;
    border-top: 1px solid rgba(240, 238, 233, 0.15);
    font-size: 18px;
    line-height: 1.4;
  }

  strong {
    font-weight: inherit;
    color: #ff5100;
  }

  @media (min-width: 810px) {
    .estimator {
      padding: 32px;
    }

    .sliders {
      grid-template-columns: 1fr 1fr;
      gap: 32px;
    }
  }
</style>
