<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Card } from './card';
  import { tilt } from '../tilt';

  let { cards }: { cards: Card[] } = $props();

  const CARDS: Record<Card, Snippet> = { [Card.Generation]: generation };
</script>

{#snippet generation()}
  <article class="card gen" use:tilt>
    <img data-agent-id="feature-gen" src="/site/home/tool-gen.webp" alt="" width="920" height="1269" loading="lazy" decoding="async" />
    <span class="focus" aria-hidden="true"></span>
    <h3 data-agent-id="feature-gen-title">Text, image, video, 3D generation</h3>
  </article>
{/snippet}

<section class="features">
  <div class="cards">
    {#each cards as card (card)}
      {@render CARDS[card]()}
    {/each}
  </div>
</section>

<style>
  .features {
    color: var(--site-ink);
  }

  .cards {
    display: grid;
    gap: 15px;
  }

  .card {
    position: relative;
    overflow: hidden;
    border-radius: 12px;
    background: #171717;
    transform: perspective(1500px);
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  h3 {
    font-size: 22px;
    line-height: 24px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .gen {
    height: 455px;
  }

  .gen img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .focus {
    position: absolute;
    left: calc(50% - 108px);
    top: 35px;
    width: 216px;
    height: 213px;
    border: 2px solid #fff;
    border-radius: 12px;
  }

  .focus::after {
    content: '';
    position: absolute;
    left: calc(50% - 7px);
    top: calc(50% - 7px);
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #ff5100;
  }

  .gen h3 {
    position: absolute;
    left: 20px;
    right: 35px;
    bottom: 20px;
  }

  @media (min-width: 1200px) {
    .cards {
      gap: 16px;
    }

    .card {
      height: 557px;
    }

    h3 {
      font-size: 30px;
      line-height: 33px;
    }

    .focus {
      left: calc(50% - 132.5px);
      top: 52px;
      width: 265px;
      height: 245px;
    }

    .gen h3 {
      right: 72px;
    }

  }

  @media (min-width: 810px) and (max-width: 1199.98px) {
    .cards {
      gap: 16px;
    }

    h3 {
      font-size: 26px;
      line-height: 28.6px;
    }

    .gen {
      height: 878px;
    }

    .focus {
      left: calc(50% - 251px);
      top: 24px;
      width: 502px;
      height: 456px;
    }

    .gen h3 {
      right: 137px;
    }

  }
</style>
