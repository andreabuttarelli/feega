<script lang="ts">
  import { CANVAS_VIDEO, HERO_HEADLINE } from '../home';
  import { lazyPlay } from '../lazy-video';
  import NpxChip from './NpxChip.svelte';
  import HeroPrompt from './HeroPrompt.svelte';
  import AsciiField from './AsciiField.svelte';
  import { FREE_EDITORS, PLAN } from '../pricing/plan';
  import { DOWNLOAD_MAC_PATH } from '../links';
  import { APPLE_ICON } from '../social-icons';

  const POSTER = '/site/home/canvas-poster.webp';
</script>

<svelte:head>
  <link rel="preload" as="image" href={POSTER} type="image/webp" fetchpriority="high" />
  <link rel="preload" href="/site/fonts/instrument-serif-latin.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<section class="hero" id="hero">
  <AsciiField />

  <h1><span data-agent-id="hero-title-a">{HERO_HEADLINE[0]}</span> <span data-agent-id="hero-title-b">{HERO_HEADLINE[1]}</span></h1>

  <p class="lead" data-agent-id="hero-lead">Feega is an open-source canvas to design, animate and generate. Start from your repo, Figma or any website.</p>

  <div class="start" data-agent-id="hero-start">
    <HeroPrompt />
  </div>

  <div class="modes" data-agent-id="hero-modes">
    <div class="mode">
      <div class="head">
        <span class="kicker">On your computer</span>
        <span class="price">Free</span>
      </div>
      <p>No account. Works with Claude Code, Codex or Cursor.</p>
      <div class="ways">
        <NpxChip />
        <span class="or">or</span>
        <a class="mac" href={DOWNLOAD_MAC_PATH} data-sveltekit-reload>{@html APPLE_ICON}Mac app</a>
      </div>
    </div>

    <div class="mode">
      <div class="head">
        <span class="kicker">In the cloud</span>
        <span class="price">Free for {FREE_EDITORS} {PLAN.per}</span>
      </div>
      <p>Your team on the same canvas, live. Then {PLAN.currency}{PLAN.price} per {PLAN.per} a {PLAN.period}.</p>
      <div class="ways">
        <span class="faces" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="live">3 editing now</span>
      </div>
    </div>
  </div>

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
    color: #fff;
    font-family: 'Instrument Serif', serif;
    font-variation-settings: normal;
    font-size: 48px;
    line-height: 0.95;
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

  @media (max-width: 809.98px) {
    .start {
      width: 100%;
    }
  }

  .modes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    width: calc(100% - 32px);
    max-width: 680px;
    margin-top: 12px;
    color: #fff;
    text-align: left;
  }

  .mode {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 18px;
    border-radius: 20px;
    background: rgb(18 18 18 / 0.72);
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.07);
    backdrop-filter: blur(12px);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .kicker {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .price {
    padding: 3px 8px;
    border-radius: 999px;
    background: rgb(255 255 255 / 0.08);
    font-family: 'DM Mono', monospace;
    font-size: 12px;
    letter-spacing: -0.02em;
    color: rgb(255 255 255 / 0.85);
    white-space: nowrap;
  }

  .mode p {
    margin: 0;
    font-size: 13px;
    line-height: 1.4;
    color: rgb(255 255 255 / 0.6);
  }

  .ways {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: auto;
    min-height: 28px;
  }

  .or {
    font-size: 12px;
    color: rgb(255 255 255 / 0.4);
  }

  .mac {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 8px;
    background: #222;
    color: #fff;
    font-size: 14px;
    text-decoration: none;
    white-space: nowrap;
    transition: background 0.15s;
  }

  .mac:hover {
    background: #2e2e2e;
  }

  .mac :global(svg) {
    width: 14px;
    height: 14px;
  }

  .faces {
    display: flex;
  }

  .faces i {
    width: 22px;
    height: 22px;
    margin-right: -6px;
    border-radius: 50%;
    box-shadow: 0 0 0 2px #121212;
  }

  .faces i:nth-child(1) { background: #ff7373; }
  .faces i:nth-child(2) { background: #0099ff; }
  .faces i:nth-child(3) { background: #ffd84a; }

  .live {
    margin-left: 10px;
    font-size: 12px;
    color: rgb(255 255 255 / 0.6);
  }

  .live::before {
    content: '';
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-right: 6px;
    border-radius: 50%;
    background: #2fbf71;
    vertical-align: 1px;
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

  @media (max-width: 809.98px) {
    .start {
      width: 100%;
    }
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
    .modes {
      grid-template-columns: 1fr;
      gap: 0;
      width: 100%;
      overflow: hidden;
      border-radius: 20px;
      background: rgb(18 18 18 / 0.72);
      box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.07);
      backdrop-filter: blur(12px);
    }

    .mode {
      gap: 6px;
      padding: 14px 16px;
      border-radius: 0;
      background: none;
      box-shadow: none;
      backdrop-filter: none;
    }

    .mode + .mode {
      box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.07);
    }

    .kicker {
      font-size: 14px;
    }

    .mode p {
      font-size: 12.5px;
    }

    .ways:has(.faces) {
      display: none;
    }

    .ways :global(.npx) {
      font-size: 14px;
    }

    .mac {
      font-size: 13px;
    }
  }
</style>
