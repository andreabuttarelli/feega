<script lang="ts">
  import { CANVAS_VIDEO, TICKER_VIDEOS } from '../home';
  import { lazyPlay } from '../lazy-video';
  import NpxChip from './NpxChip.svelte';
  import HeroPrompt from './HeroPrompt.svelte';

  const POSTER = '/site/home/canvas-poster.webp';
</script>

<svelte:head>
  <link rel="preload" as="image" href={POSTER} type="image/webp" fetchpriority="high" />
  <link rel="preload" href="/site/fonts/instrument-serif-latin.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<section class="hero" id="hero">
  <h1><span data-agent-id="hero-title-a">Design inside your code</span> <span data-agent-id="hero-title-b">with your agents and team.</span></h1>

  <p class="lead" data-agent-id="hero-lead">Paste any website. Claude rebuilds it as editable layers, animates it on a real timeline, and you ship it as video or code.</p>

  <div class="start" data-agent-id="hero-start">
    <HeroPrompt />
  </div>

  <p class="run"><span>or run it locally:</span> <NpxChip /></p>

  <video class="canvas" data-agent-id="hero-canvas" data-src={CANVAS_VIDEO} muted loop playsinline preload="none" poster={POSTER} width="1920" height="1080" aria-label="Feega canvas overview" use:lazyPlay></video>

  <div class="ticker" data-agent-id="hero-ticker" aria-label="Videos made with Feega">
    {#each TICKER_VIDEOS as src (src)}
      <video data-src={src} muted loop playsinline preload="none" width="1920" height="1080" use:lazyPlay></video>
    {/each}
  </div>
</section>

<style>
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 430px;
    margin: 0 auto;
    padding: 140px 20px 0;
    text-align: center;
  }

  h1 {
    color: #fff;
    font-family: 'Instrument Serif', serif;
    font-variation-settings: normal;
    font-size: 48px;
    line-height: 0.8;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  h1 span {
    display: block;
  }

  .lead {
    margin-top: 22px;
    opacity: 0.8;
  }

  .start {
    width: calc(100% - 32px);
    max-width: 680px;
    margin-top: 28px;
  }

  .run {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
  }

  .run span {
    opacity: 0.8;
    color: #fff;
  }

  video {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
  }

  .canvas {
    margin-top: 100px;
    border-radius: 8px;
  }

  .ticker {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    width: 100%;
    margin-top: 100px;
  }

  @media (min-width: 1200px) {
    .hero {
      max-width: 1100px;
      padding: 150px 20px 0;
    }

    h1 {
      font-size: 80px;
      line-height: 64px;
    }

    .lead {
      width: 600px;
      font-size: 16px;
      line-height: 19.2px;
    }

    .ticker {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (min-width: 810px) and (max-width: 1199.98px) {
    .hero {
      max-width: 810px;
      padding: 150px 16px 0;
    }

    h1 {
      font-size: 80px;
      line-height: 64px;
    }

    .lead {
      width: 550px;
    }

    .ticker {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
</style>
