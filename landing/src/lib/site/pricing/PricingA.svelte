<script lang="ts">
  import { APP_URL, DOCS_URL } from '../links';
  import NpxChip from '../home/NpxChip.svelte';
  import PriceTag from './PriceTag.svelte';
  import PricingFaq from './PricingFaq.svelte';
  import { Tone, CLOUD_BENEFITS, CLOUD_FOR, LOCAL_BENEFITS, LOCAL_FOR, OUT_OF_CREDITS, getsYou, money, topUpLine, trialLine, type CloudPlan } from './plan';

  let { plan }: { plan: CloudPlan } = $props();
</script>

<section class="pricing site-wide" id="pricing" aria-labelledby="pricing-title">
  <h2 id="pricing-title">Free on your machine.<br />One plan in the cloud.</h2>

  <div class="cards">
    <article class="card">
      <h3>Local</h3>
      <p class="for">{LOCAL_FOR}</p>
      <PriceTag amount={money(0)} unit="forever" cta="Run it locally" href={DOCS_URL} tone={Tone.Quiet} />
      <p class="run"><NpxChip /></p>
      <ul>
        {#each LOCAL_BENEFITS as line (line)}<li>{line}</li>{/each}
      </ul>
    </article>

    <article class="card cloud">
      <h3>{plan.name}</h3>
      <p class="for">{CLOUD_FOR}</p>
      <PriceTag amount={money(plan.price)} unit="/ {plan.period}" cta="Start free" href={APP_URL} />
      <p class="trial">{trialLine()}</p>
      <ul>
        {#each CLOUD_BENEFITS as line (line)}<li>{line}</li>{/each}
      </ul>
      <div class="usage">
        <p>{getsYou(plan)}</p>
        <p>{topUpLine(plan)}</p>
        <p>{OUT_OF_CREDITS}</p>
      </div>
    </article>
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

  .cards {
    display: grid;
    gap: 16px;
    margin-top: 48px;
  }

  .card {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 28px 24px;
    border-radius: 10px;
    background: #000;
  }

  .cloud {
    box-shadow: inset 0 0 0 1px #ff5100;
  }

  h3 {
    margin: 0;
    font-size: 24px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .for {
    margin: -12px 0 8px;
    opacity: 0.6;
  }

  .run,
  .trial {
    margin: 0;
  }

  .trial {
    opacity: 0.7;
  }

  ul {
    display: grid;
    gap: 10px;
    margin: 8px 0 0;
    padding: 20px 0 0;
    border-top: 1px solid rgba(240, 238, 233, 0.15);
    list-style: none;
  }

  li {
    position: relative;
    padding-left: 22px;
    line-height: 1.4;
  }

  li::before {
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

  .usage {
    display: grid;
    gap: 8px;
    margin-top: auto;
    padding: 16px;
    border-radius: 6px;
    background: #1a1a1a;
  }

  .usage p {
    margin: 0;
    line-height: 1.4;
  }

  .usage p:first-child {
    color: #fff;
  }

  .usage p + p {
    opacity: 0.65;
  }

  @media (min-width: 810px) {
    .pricing {
      padding: var(--site-section) 0;
    }

    h2 {
      font-size: 40px;
      line-height: 42px;
    }

    .cards {
      grid-template-columns: 1fr 1fr;
      align-items: stretch;
    }
  }

  @media (min-width: 1200px) {
    h2 {
      font-size: 48px;
      line-height: 50px;
    }

    .card {
      padding: 36px 32px;
    }
  }
</style>
