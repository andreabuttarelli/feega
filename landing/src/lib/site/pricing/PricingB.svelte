<script lang="ts">
  import { APP_URL, DOCS_URL } from '../links';
  import PriceTag from './PriceTag.svelte';
  import PricingFaq from './PricingFaq.svelte';
  import { CLOUD_BENEFITS, CLOUD_FOR, OUT_OF_CREDITS, creditSteps, getsYou, money, trialLine, type CloudPlan } from './plan';

  let { plan }: { plan: CloudPlan } = $props();
</script>

<section class="pricing site-wide" id="pricing" aria-labelledby="pricing-title">
  <h2 id="pricing-title">One plan. Everything in it.</h2>

  <article class="hero">
    <div class="buy">
      <h3>feega {plan.name}</h3>
      <p class="for">{CLOUD_FOR}</p>
      <PriceTag amount={money(plan.price)} unit="/ {plan.period}" cta="Start free" href={APP_URL} size="huge" />
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

  <div class="credits">
    <h3>How credits work</h3>
    <ol>
      {#each creditSteps(plan) as step, i (step.title)}
        <li>
          <span class="n" aria-hidden="true">0{i + 1}</span>
          <h4>{step.title}</h4>
          <p>{step.body}</p>
        </li>
      {/each}
    </ol>
    <p class="out">{OUT_OF_CREDITS}</p>
  </div>

  <PricingFaq {plan} />
</section>

<style>
  .pricing {
    padding: var(--site-section) 16px;
    color: var(--site-ink);
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
    font-size: 24px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .for {
    margin: -8px 0 16px;
    opacity: 0.6;
  }

  .trial,
  .label,
  .gets,
  .local,
  .out {
    margin: 0;
  }

  .trial {
    opacity: 0.7;
  }

  .what {
    display: grid;
    align-content: start;
    gap: 16px;
  }

  .label {
    opacity: 0.5;
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
    padding-left: 22px;
    line-height: 1.4;
  }

  ul li::before {
    content: '';
    position: absolute;
    top: 0.5em;
    left: 2px;
    width: 8px;
    height: 5px;
    border-bottom: 1.5px solid #ff5100;
    border-left: 1.5px solid #ff5100;
    transform: rotate(-45deg);
  }

  .gets {
    padding-top: 16px;
    border-top: 1px solid rgba(240, 238, 233, 0.15);
    opacity: 0.8;
  }

  .local {
    margin-top: 20px;
    opacity: 0.75;
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

  .credits {
    margin-top: 80px;
  }

  ol {
    display: grid;
    gap: 24px;
    margin: 28px 0 0;
    padding: 0;
    list-style: none;
  }

  ol li {
    display: grid;
    gap: 6px;
    padding: 20px 0 0;
    border-top: 1px solid rgba(240, 238, 233, 0.25);
  }

  .n {
    color: #ff5100;
  }

  h4 {
    margin: 0;
    font-size: 20px;
    letter-spacing: -0.03em;
    font-weight: 400;
  }

  ol p {
    margin: 0;
    opacity: 0.65;
    line-height: 1.4;
  }

  .out {
    margin-top: 28px;
    opacity: 0.8;
  }

  @media (min-width: 810px) {
    .pricing {
      padding: var(--site-section) 0;
    }

    h2 {
      font-size: 40px;
      line-height: 42px;
    }

    .hero {
      grid-template-columns: 1.1fr 1fr;
      padding: 40px;
    }

    ol {
      grid-template-columns: repeat(3, 1fr);
      gap: 32px;
    }
  }

  @media (min-width: 1200px) {
    h2 {
      font-size: 48px;
      line-height: 50px;
    }

    .hero {
      padding: 48px;
    }
  }
</style>
