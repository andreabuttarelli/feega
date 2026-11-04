<script lang="ts">
  import { APP_URL } from '../links';
  import { CANVAS_VIDEO } from '../home';
  import NpxChip from './NpxChip.svelte';

  const POSTER = '/site/home/canvas-poster.webp';
</script>

<svelte:head>
  <link rel="preload" as="image" href={POSTER} type="image/webp" fetchpriority="high" />
</svelte:head>

<section class="hero" id="hero">
  <h1><span>The smart canvas</span> <span>for smarter ideas</span></h1>

  <div class="lead">
    <p><strong>The all-in-one open-source alternative of Figma, Jitter &amp; Flora.</strong></p>
    <p>From AI generation and UI &amp; graphic design to motion and interactive experiences, bring your entire creative workflow into one infinite canvas.</p>
  </div>

  <a class="site-pill" href={APP_URL}>Start Now</a>

  <p class="run"><span>Or just run</span> <NpxChip /></p>

  <video autoplay muted loop playsinline preload="metadata" poster={POSTER} width="1920" height="1080" aria-label="Feega canvas overview" src={CANVAS_VIDEO}></video>
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
    font-size: 72px;
    line-height: 57.6px;
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

  .lead strong {
    display: block;
    padding: 0 17px;
    font-weight: inherit;
  }

  .lead p + p {
    margin-top: 20px;
  }

  .site-pill {
    margin-top: 22px;
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
    margin-top: 100px;
    aspect-ratio: 16 / 9;
    border-radius: 8px;
    object-fit: cover;
  }

  @media (min-width: 810px) {
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
    }

    .lead strong {
      padding: 0;
    }
  }
</style>
