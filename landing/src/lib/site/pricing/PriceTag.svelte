<script lang="ts">
  import { eventAttrs } from '../analytics/attrs';

  let { amount, unit, cta, href, plan, tone = 'solid' }: { amount: string; unit: string; cta: string; href: string; plan: string; tone?: 'solid' | 'outline' } = $props();
</script>

<div class="tag">
  <p class="price"><span class="amount">{amount}</span> <span class="unit">{unit}</span></p>
  <a class="cta" class:outline={tone === 'outline'} {href} {...eventAttrs('pricing_cta', { plan })}>{cta}</a>
</div>

<style>
  .tag {
    display: contents;
  }

  .price {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0;
  }

  .amount {
    font-size: 48px;
    white-space: nowrap;
    line-height: 1;
    letter-spacing: -0.05em;
    font-weight: 400;
  }

  .unit {
    font-size: 18px;
    opacity: 0.65;
  }

  .cta {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    min-height: 48px;
    padding: 0 24px;
    border-radius: 100px;
    background: #ff5100;
    color: #fff;
    font-family: 'IBM Plex Sans', sans-serif;
    font-variation-settings: normal;
    font-size: 18px;
    font-weight: 500;
    letter-spacing: -0.02em;
    text-decoration: none;
    transition: background 0.2s ease;
  }

  .cta.outline {
    background: transparent;
    box-shadow: inset 0 0 0 1px rgba(240, 238, 233, 0.4);
  }

  .cta.outline:hover {
    background: rgba(240, 238, 233, 0.1);
  }

  .cta:hover {
    background: #ff6a26;
  }

  .cta:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 3px;
  }

  @media (min-width: 1200px) {
    .amount {
      font-size: 64px;
    }

    .unit {
      font-size: 20px;
    }
  }
</style>
