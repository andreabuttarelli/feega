<script lang="ts">
  import { APP_URL, DOCS_URL } from '../links';
  import PriceTag from './PriceTag.svelte';
  import Estimator from './Estimator.svelte';
  import PricingFaq from './PricingFaq.svelte';
  import { CLOUD_BENEFITS, CLOUD_FOR, CREDIT_RULES, getsYou, money, outOfCredits, trialLine, type CloudPlan } from './plan';

  let { plan }: { plan: CloudPlan } = $props();
</script>

<section class="pricing site-wide" id="pricing" aria-labelledby="pricing-title">
  <h2 id="pricing-title">One plan. Everything in it.</h2>

  <article class="hero">
    <div class="buy">
      <h3>feega {plan.name}</h3>
      <p class="for">{CLOUD_FOR}</p>
      <PriceTag amount={money(plan, plan.price)} unit="/ {plan.period}" cta="Start free" href={APP_URL} />
      <p class="trial">{trialLine()}</p>
    </div>
    <div class="what">
      <p class="label">What you get</p>
      <ul>
        {#each CLOUD_BENEFITS as line (line)}<li>{line}</li>{/each}
      </ul>
      <p class="gets">{getsYou(plan)}</p>
    </div>
  </article>

  <p class="local">Prefer your own AI keys? feega is <strong>free on your machine, forever</strong>. <a href={DOCS_URL}>Run it locally →</a></p>

  <Estimator {plan} />

  <div class="rules">
    <p>{CREDIT_RULES}</p>
    <p>{outOfCredits(plan)}</p>
  </div>

  <PricingFaq {plan} />
</section>

<style>
  .pricing {
    padding: var(--site-section) 16px;
    color: var(--site-ink);
    font-size: 16px;
    line-height: 1.45;
  }

  p {
    margin: 0;
  }

  h2 {
    margin: 0;
    font-size: 34px;
    line-height: 36px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .hero {
    display: grid;
    gap: 40px;
    margin-top: 48px;
    padding: 28px 24px;
    border-radius: 10px;
    background: #000;
  }

  .buy {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  h3 {
    margin: 0;
    font-size: 26px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .for {
    margin: -8px 0 16px;
    opacity: 0.7;
  }

  .trial {
    opacity: 0.75;
  }

  .what {
    display: grid;
    align-content: start;
    gap: 16px;
  }

  .label {
    opacity: 0.55;
  }

  ul {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    position: relative;
    padding-left: 24px;
  }

  li::before {
    content: '';
    position: absolute;
    top: 0.5em;
    left: 2px;
    width: 9px;
    height: 5px;
    border-bottom: 1.5px solid #ff5100;
    border-left: 1.5px solid #ff5100;
    transform: rotate(-45deg);
  }

  .gets {
    padding-top: 16px;
    border-top: 1px solid rgba(240, 238, 233, 0.15);
    opacity: 0.85;
  }

  .local {
    margin-top: 20px;
    opacity: 0.8;
  }

  .local strong {
    font-weight: inherit;
    color: #fff;
  }

  .local a {
    display: inline-block;
    padding: 4px 0;
    border-bottom: 1px solid currentColor;
  }

  .local a:focus-visible {
    outline: 2px solid #ff5100;
    outline-offset: 3px;
  }

  .rules {
    display: grid;
    gap: 4px;
    margin-top: 16px;
    opacity: 0.8;
  }

  @media (min-width: 810px) {
    .pricing {
      padding: var(--site-section) 0;
      font-size: 18px;
    }

    h2 {
      font-size: 40px;
      line-height: 42px;
    }

    .hero {
      grid-template-columns: 1.1fr 1fr;
      padding: 40px;
    }
  }

  @media (min-width: 1200px) {
    h2 {
      font-size: 48px;
      line-height: 50px;
    }

    h3 {
      font-size: 30px;
    }

    .hero {
      padding: 48px;
    }
  }
</style>
