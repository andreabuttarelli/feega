<script lang="ts">
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import TourFilm from '../TourFilm.svelte';

  const CHIPS = ['Product launch', 'App walkthrough', 'Logo reveal', 'Offer promo'];

  const FILMS = [
    { intro: 'ship it.', accent: '#ffffff', name: 'Launch film' },
    { intro: 'run faster.', accent: '#e4572e', name: 'Runner drop' },
    { intro: 'meet acme.', accent: '#0099ff', name: 'Logo reveal' }
  ];
</script>

<div class="scene">
  <h3>make a video.</h3>
  <div class="field">
    <span class="caret"></span>
    <span class="hint">Your website or what you want to make</span>
    <span class="go">Make it <ArrowRight size={18} strokeWidth={2} /></span>
  </div>
  <div class="chips">
    {#each CHIPS as chip (chip)}<span>{chip}</span>{/each}
  </div>

  <div class="films">
    {#each FILMS as film, i (film.name)}
      <figure style:--i={i}>
        <TourFilm intro={film.intro} accent={film.accent} />
        <figcaption>{film.name}</figcaption>
      </figure>
    {/each}
  </div>
</div>

<style>
  .scene {
    --loop: 8s;
    --expo: cubic-bezier(0.16, 1, 0.3, 1);
    position: absolute;
    inset: 0;
    padding: 70px 120px 0;
    font-family: var(--ui-sans, 'DM Sans', system-ui, sans-serif);
    color: var(--ui-ink, #111);
  }

  h3 {
    margin: 0 0 24px;
    font-size: 72px;
    font-weight: 600;
    letter-spacing: -0.045em;
    line-height: 0.95;
  }

  .field {
    display: flex;
    align-items: center;
    height: 72px;
    padding-left: 22px;
    background: var(--ui-bg, #fff);
    box-shadow: 0 0 0 1.5px var(--ui-accent, #0099ff), 0 24px 60px -30px rgba(0, 0, 0, 0.4);
    font-size: 20px;
  }

  .caret {
    width: 2px;
    height: 28px;
    margin-right: 4px;
    background: var(--ui-accent, #0099ff);
    animation: blink 1s steps(1) infinite;
  }

  .hint {
    color: var(--ui-ink-3, #93938e);
  }

  .go {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 100%;
    margin-left: auto;
    padding: 0 28px;
    background: var(--ui-ink, #111);
    color: var(--ui-bg, #fff);
    font-size: 17px;
    font-weight: 600;
  }

  .chips {
    display: flex;
    gap: 10px;
    margin-top: 16px;
  }

  .chips span {
    padding: 9px 14px;
    background: var(--ui-bg, #fff);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-ink, #111) 12%, transparent);
    font-size: 14px;
  }

  .films {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 18px;
    margin-top: 44px;
  }

  figure {
    margin: 0;
    animation: rise var(--loop) var(--expo) both;
    animation-delay: calc(0.2s + var(--i) * 0.12s);
    animation-iteration-count: 1;
  }

  figcaption {
    margin-top: 10px;
    font-size: 14px;
  }

  @keyframes blink {
    50% { opacity: 0; }
  }

  @keyframes rise {
    0% { opacity: 0; transform: translateY(30px); }
    12%, 100% { opacity: 1; transform: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .scene * {
      animation: none !important;
    }
  }
</style>
