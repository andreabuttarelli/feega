<script lang="ts">
  import { lower } from '../lower';
  import { APP_URL, DOCS_URL } from '../links';
  import PriceTag from './PriceTag.svelte';
  import { CLOUD_FOR, CLOUD_LINES, LOCAL_FOR, LOCAL_LINES, LOCAL_NOTE, AGENT_DOCS_URL, SEAT_RULE, bringYourAgent, creditsLine, freeStart, freeTier, getsYou, money, moreSeats, priceUnit, type CloudPlan } from './plan';

  const LOCAL_DOCS_URL = `${DOCS_URL}/getting-started/local-mode/`;

  let { plan, details = 'hide' }: { plan: CloudPlan; details?: 'show' | 'hide' } = $props();
</script>

<div class="plans">
  <article class="plan">
    <div class="strip terminal" aria-hidden="true"><span>$</span>npx feega my-canvas.feega</div>
    <h3>local</h3>
    <p class="for">{lower(LOCAL_FOR)}</p>
    <PriceTag amount="free" unit="forever" cta="run it locally" href={LOCAL_DOCS_URL} tone="outline" />
    <p class="start">{lower(LOCAL_NOTE)}</p>
    <ul>
      {#each LOCAL_LINES as line (line)}<li>{lower(line)}</li>{/each}
    </ul>
  </article>

  <article class="plan">
    <div class="strip canvas" aria-hidden="true"></div>
    <h3>Feega {plan.name}</h3>
    <p class="for">{lower(CLOUD_FOR)}</p>
    <PriceTag amount={money(plan, plan.price)} unit={priceUnit(plan)} cta="start free" href={APP_URL} />
    <p class="start">{lower(freeStart(plan))}</p>
    <ul>
      {#each CLOUD_LINES as line (line)}<li>{lower(line)}</li>{/each}
    </ul>
    <p class="credits">{lower(creditsLine(plan))}</p>
  </article>
</div>

{#if details === 'show'}
<details class="details">
  <summary>plan details</summary>
  <p class="trial">{lower(freeTier())}</p>
  <p class="trial">{lower(SEAT_RULE)}</p>
  <p class="trial">{lower(getsYou(plan))}</p>
  <p class="trial">{lower(bringYourAgent(plan))} <a class="link" href={AGENT_DOCS_URL}>connect your agent →</a></p>
  <p class="trial">{lower(moreSeats(plan))}</p>
</details>
{/if}

<style>
  p {
    margin: 0;
  }

  .details {
    margin-top: 16px;
  }

  .plans {
    display: grid;
    gap: 16px;
    margin-top: 48px;
  }

  .plan {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 28px 24px;
    border-radius: 10px;
    background: #000;
  }

  h3 {
    margin: 0;
    font-size: 26px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .for {
    margin: -8px 0 8px;
    opacity: 0.7;
  }

  .start {
    color: #fff;
  }

  .trial {
    margin-top: 12px;
    opacity: 0.75;
  }

  ul {
    display: grid;
    gap: 12px;
    margin: 8px 0 0;
    padding: 16px 0 0;
    border-top: 1px solid rgba(240, 238, 233, 0.15);
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

  .credits {
    opacity: 0.85;
  }

  .link {
    display: inline-block;
    padding: 4px 0;
    border-bottom: 1px solid currentColor;
    color: #fff;
  }

  .link:focus-visible {
    outline: 2px solid #ff5100;
    outline-offset: 3px;
  }

  .strip {
    height: 140px;
    margin: -12px -12px 8px;
    border-radius: 6px;
    background: #111;
  }

  .strip.canvas {
    background: url('/site/home/canvas-poster.webp') center / cover;
  }

  .strip.terminal {
    display: flex;
    align-items: center;
    padding: 0 20px;
    font-family: 'Fragment Mono', monospace;
    font-size: 14px;
    color: rgba(240, 238, 233, 0.8);
  }

  .strip.terminal span {
    color: #ff5100;
    margin-right: 10px;
  }

  @media (min-width: 810px) {
    .plans {
      grid-template-columns: 1fr 1fr;
    }

    .plan {
      display: grid;
      grid-row: span 8;
      grid-template-rows: subgrid;
      align-content: start;
    }

    .plan {
      padding: 40px;
    }
  }

  @media (min-width: 1200px) {
    h3 {
      font-size: 30px;
    }

    .plan {
      padding: 48px;
    }
  }
</style>
