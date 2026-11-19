<script lang="ts">
  import { lower } from '../lower';
  import InstallCta from '../InstallCta.svelte';
  import { HERO_HEADLINE } from '../home';
  import AsciiField from './AsciiField.svelte';
  import HeroVideo, { POSTER } from './HeroVideo.svelte';
</script>

<svelte:head>
  <link rel="preload" as="image" href={POSTER} type="image/webp" fetchpriority="high" />
  <link rel="preload" href="/site/fonts/instrument-serif-latin.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<section class="hero" id="hero">
  <AsciiField />

  <h1 class="site-display"><span data-agent-id="hero-title-a">{lower(HERO_HEADLINE[0])}</span> <span data-agent-id="hero-title-b">{lower(HERO_HEADLINE[1])}</span></h1>

  <p class="lead" data-agent-id="hero-lead">click any element of your running app and edit it like in figma. the change is written to your code. no AI, no tokens, every edit a diff.</p>

  <InstallCta id="hero-install" />

  <HeroVideo />
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

  .hero > :global(.install) {
    margin-top: 28px;
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
