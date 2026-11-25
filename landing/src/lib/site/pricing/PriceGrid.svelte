<script lang="ts">
  import { lower } from '../lower';
  import { GITHUB_URL } from '../links';
  import { primaryCta } from '../install';
  import PriceTag from './PriceTag.svelte';
  import { CLOUD_SOON_FOR, CLOUD_SOON_LINES, EXTENSION_FOR, EXTENSION_LINES, EXTENSION_NOTE, CLOUD_SOON_NOTE, annualLine, priceLabel, priceUnit, type CloudPlan } from './plan';

  let { plan, details = 'hide' }: { plan: CloudPlan; details?: 'show' | 'hide' } = $props();

  const install = primaryCta();
</script>

<div class="plans">
  <article class="plan">
    <div class="strip terminal" aria-hidden="true"><span>$</span>npx feega</div>
    <h3>Feega extension</h3>
    <p class="for">{lower(EXTENSION_FOR)}</p>
    <PriceTag amount="free" unit="forever" cta={lower(install.label)} href={install.href} plan="extension" />
    <p class="start">{lower(EXTENSION_NOTE)}</p>
    <ul>
      {#each EXTENSION_LINES as line (line)}<li>{lower(line)}</li>{/each}
    </ul>
  </article>

  <article class="plan">
    <div class="strip canvas" aria-hidden="true"></div>
    <h3>Feega {plan.name}</h3>
    <p class="for">{lower(CLOUD_SOON_FOR)}</p>
    <PriceTag amount={priceLabel(plan)} unit={lower(priceUnit(plan))} cta="follow on github" href={GITHUB_URL} tone="outline" plan="cloud" />
    <p class="start">{lower(annualLine(plan))} {lower('Coming soon.')} {lower(CLOUD_SOON_NOTE)}</p>
    <ul>
      {#each CLOUD_SOON_LINES as line (line)}<li>{lower(line)}</li>{/each}
    </ul>
    <p class="start">{lower('The free library is already open:')} <a href="/templates">{lower('free templates')}</a></p>
  </article>
</div>


<style>
  p {
    margin: 0;
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


  ul {
    display: grid;
    align-content: start;
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
      grid-row: span 7;
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
