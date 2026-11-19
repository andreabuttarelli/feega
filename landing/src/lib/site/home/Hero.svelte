<script lang="ts">
  import { lower } from '../lower';
  import InstallCta from '../InstallCta.svelte';
  import { HERO_HEADLINE } from '../home';
  import AsciiField from './AsciiField.svelte';
  import EditorMock from '../EditorMock.svelte';
  import TerminalMock from './TerminalMock.svelte';
  import WorksWith from './WorksWith.svelte';

  const MOCK_WIDTH = 960;

  let fitWidth = $state(MOCK_WIDTH);
  let mockHeight = $state(0);

  const scale = $derived(Math.min(1, fitWidth / MOCK_WIDTH));
</script>

<svelte:head>
  <link rel="preload" href="/site/fonts/instrument-serif-latin.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<section class="hero" id="hero">
  <AsciiField />

  <h1 class="site-display"><span data-agent-id="hero-title-a">{lower(HERO_HEADLINE[0])}</span> <span data-agent-id="hero-title-b">{lower(HERO_HEADLINE[1])}</span></h1>

  <p class="lead" data-agent-id="hero-lead">click any element of your running app and edit it like in figma. the change is written to your code. no AI, no tokens, every edit a diff.</p>

  <InstallCta id="hero-install" />

  <div class="fit" bind:clientWidth={fitWidth} style:height="{mockHeight * scale}px">
    <div class="mock" bind:offsetHeight={mockHeight} style:transform="scale({scale})">
      <div class="term"><TerminalMock /></div>
      <div class="win"><EditorMock /></div>
    </div>
  </div>

  <WorksWith />
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


  .fit {
    width: 100%;
    max-width: 960px;
    margin: 36px auto 0;
  }

  .mock {
    position: relative;
    width: 960px;
    box-sizing: border-box;
    padding: 40px 40px 56px;
    transform-origin: top left;
    border-radius: var(--ui-radius-lg, 10px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    background:
      radial-gradient(ellipse 70% 60% at 85% 100%, rgba(255, 81, 0, 0.55), transparent 70%),
      radial-gradient(ellipse 60% 50% at 10% 0%, rgba(120, 90, 255, 0.28), transparent 70%),
      radial-gradient(ellipse 50% 40% at 50% 110%, rgba(255, 190, 80, 0.2), transparent 70%),
      #0d0d0d;
    overflow: hidden;
  }

  .mock .win {
    position: relative;
    z-index: 2;
    width: 84%;
    margin: 0 16% 230px 0;
  }

  .mock .term {
    position: absolute;
    z-index: 1;
    bottom: 28px;
    right: 28px;
    width: 52%;
    height: 420px;
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
