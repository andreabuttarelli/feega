<script lang="ts">
  import { Tone } from './plan';

  let { amount, unit, cta, href, tone = Tone.Primary, size = 'large' }: { amount: string; unit: string; cta: string; href: string; tone?: Tone; size?: 'large' | 'huge' } = $props();
</script>

<div class="tag" data-size={size}>
  <p class="price"><span class="amount">{amount}</span> <span class="unit">{unit}</span></p>
  <a class="cta" data-tone={tone} {href}>{cta}</a>
</div>

<style>
  .tag {
    display: grid;
    gap: 20px;
  }

  .price {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin: 0;
  }

  .amount {
    font-size: 56px;
    line-height: 1;
    letter-spacing: -0.05em;
    font-weight: 400;
  }

  [data-size='huge'] .amount {
    font-size: 72px;
  }

  .unit {
    opacity: 0.6;
  }

  .cta {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    min-height: 44px;
    padding: 0 24px;
    border-radius: 100px;
    font-family: 'IBM Plex Sans', sans-serif;
    font-variation-settings: normal;
    font-size: 17px;
    font-weight: 500;
    letter-spacing: -0.02em;
    text-decoration: none;
    transition: background 0.2s ease;
  }

  .cta[data-tone='primary'] {
    background: #ff5100;
    color: #fff;
  }

  .cta[data-tone='primary']:hover {
    background: #ff6a26;
  }

  .cta[data-tone='quiet'] {
    box-shadow: inset 0 0 0 1px rgba(240, 238, 233, 0.35);
  }

  .cta[data-tone='quiet']:hover {
    background: rgba(240, 238, 233, 0.08);
  }

  .cta:focus-visible {
    outline: 2px solid #ff5100;
    outline-offset: 3px;
  }

  @media (min-width: 1200px) {
    .amount {
      font-size: 72px;
    }

    [data-size='huge'] .amount {
      font-size: 112px;
    }
  }
</style>
