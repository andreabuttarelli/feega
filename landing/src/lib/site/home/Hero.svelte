<script lang="ts">
  import { lower } from '../lower';
  import Modes from './Modes.svelte';
  import { CANVAS_VIDEO, HERO_HEADLINE } from '../home';
  import { lazyPlay } from '../lazy-video';
  import AsciiField from './AsciiField.svelte';

  const POSTER = '/site/home/canvas-poster.webp';
</script>

<svelte:head>
  <link rel="preload" as="image" href={POSTER} type="image/webp" fetchpriority="high" />
  <link rel="preload" href="/site/fonts/instrument-serif-latin.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<section class="hero" id="hero">
  <AsciiField />

  <h1 class="site-display"><span data-agent-id="hero-title-a">{lower(HERO_HEADLINE[0])}</span> <span data-agent-id="hero-title-b">{lower(HERO_HEADLINE[1])}</span></h1>

  <p class="lead" data-agent-id="hero-lead">paste your website or open your repo and every layer comes in editable. change it by hand or ask your AI assistant, then export a video or send the code back.</p>

  <Modes id="hero-modes" />

  <video class="canvas" data-agent-id="hero-canvas" data-src={CANVAS_VIDEO} muted loop playsinline preload="none" poster={POSTER} width="1920" height="1080" aria-label="Feega canvas overview" use:lazyPlay></video>
</section>

<style>
  .hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 430px;
    margin: 0 auto;
    padding: 140px 20px 0;
    position: relative;
    text-align: center;
  }

  .hero > :global(:not(.field)) {
    position: relative;
    z-index: 1;
  }

  h1 {
    font-size: 48px;
  }

  h1 span {
    display: block;
  }

  .lead {
    margin-top: 22px;
    opacity: 0.8;
  }

  .hero > :global(.modes) {
    margin-top: 28px;
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
  }


  @media (max-width: 809.98px) {
    .lead {
      font-size: 16px;
      line-height: 1.35;
    }
  }
</style>
