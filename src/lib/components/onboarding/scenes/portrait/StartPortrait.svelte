<script lang="ts">
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import TourFilm from '../../TourFilm.svelte';

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
    <span class="hint">Your website or an idea</span>
    <span class="go"><ArrowRight size={18} strokeWidth={2} /></span>
  </div>
  <div class="chips">
    {#each CHIPS as chip (chip)}<span>{chip}</span>{/each}
  </div>

  <div class="films">
    {#each FILMS as film, i (film.name)}
      <figure style:--i={i}>
        <TourFilm intro={film.intro} accent={film.accent} ratio="9 / 16" />
        <figcaption>{film.name}</figcaption>
      </figure>
    {/each}
  </div>
</div>

<style>
  .scene {
    --expo: cubic-bezier(0.16, 1, 0.3, 1);
    --caption: 24px;
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    padding: 68px 20px 16px;
    font-family: var(--ui-sans, 'DM Sans', system-ui, sans-serif);
    color: var(--ui-ink, #111);
  }

  h3 {
    margin: 0 0 16px;
    font-size: 44px;
    font-weight: 600;
    letter-spacing: -0.045em;
    line-height: 0.95;
  }

  .field {
    flex: none;
    display: flex;
    align-items: center;
    height: 56px;
    padding: 0 6px 0 16px;
    background: var(--ui-bg, #fff);
    box-shadow: 0 0 0 1.5px var(--ui-accent, #0099ff), 0 24px 60px -30px rgba(0, 0, 0, 0.4);
    font-size: 15px;
  }

  .caret {
    width: 2px;
    height: 22px;
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
    justify-content: center;
    width: 44px;
    height: 44px;
    margin-left: auto;
    border-radius: 50%;
    background: var(--ui-ink, #111);
    color: var(--ui-bg, #fff);
  }

  .chips {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .chips span {
    padding: 7px 12px;
    background: var(--ui-bg, #fff);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--ui-ink, #111) 12%, transparent);
    font-size: 13px;
  }

  .films {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-top: 16px;
    container-type: size;
  }

  figure {
    width: min((100cqw - 20px) / 3, (100cqh - var(--caption)) * 9 / 16);
    margin: 0;
    animation: rise 8s var(--expo) both;
    animation-delay: calc(0.2s + var(--i) * 0.12s);
    animation-iteration-count: 1;
  }

  figcaption {
    height: var(--caption);
    padding-top: 6px;
    font-size: 13px;
    white-space: nowrap;
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
