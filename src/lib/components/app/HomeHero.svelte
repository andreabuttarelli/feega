<script lang="ts">
  import { onMount } from 'svelte';
  import PageTitle from '$lib/components/PageTitle.svelte';
  import { HERO_BACKDROP, HERO_SUBLINE, HERO_TITLE, backdropPlays } from '$lib/home-hero';

  const IN_VIEW = 0.2;

  let hero = $state<HTMLElement | null>(null);
  let video = $state<HTMLVideoElement | null>(null);
  let loaded = $state(false);
  let inView = $state(true);
  let tabVisible = $state(true);
  let reducedMotion = $state(true);
  let saveData = $state(false);

  const playing = $derived(loaded && backdropPlays({ reducedMotion, saveData, tabVisible, inView }));

  onMount(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion = motion.matches;
    saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    const onMotion = () => (reducedMotion = motion.matches);
    const onVisibility = () => (tabVisible = document.visibilityState === 'visible');
    motion.addEventListener('change', onMotion);
    document.addEventListener('visibilitychange', onVisibility);

    const observer = new IntersectionObserver(([e]) => (inView = e.isIntersecting), { threshold: IN_VIEW });
    if (hero) {
      observer.observe(hero);
    }

    const idle = window.requestIdleCallback ?? ((run: () => void) => window.setTimeout(run, 1));
    idle(() => (loaded = true));

    return () => {
      motion.removeEventListener('change', onMotion);
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
    };
  });

  $effect(() => {
    if (!video) {
      return;
    }
    if (playing) {
      void video.play().catch(() => {});
      return;
    }
    video.pause();
  });
</script>

<section class="hero" bind:this={hero} aria-labelledby="home-heading" data-testid="home-hero">
  <span class="backdrop" aria-hidden="true">
    <img src={HERO_BACKDROP.poster} alt="" decoding="async" fetchpriority="low" />
    {#if loaded && !reducedMotion && !saveData}
      <video bind:this={video} src={HERO_BACKDROP.video} muted loop playsinline preload="none" class:on={playing}></video>
    {/if}
  </span>
  <span class="scrim" aria-hidden="true"></span>
  <div class="words">
    <PageTitle id="home-heading" text={HERO_TITLE} />
    <p data-testid="home-subline">{HERO_SUBLINE}</p>
  </div>
</section>

<style>
  .hero {
    position: relative;
    display: flex;
    align-items: flex-end;
    min-height: 280px;
    padding: var(--ui-space-8);
    overflow: hidden;
    background: #000;
    color: #fff;
    isolation: isolate;
  }

  .backdrop,
  .scrim {
    position: absolute;
    inset: 0;
    z-index: -1;
  }

  .backdrop img,
  .backdrop video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.5;
  }

  .backdrop video {
    opacity: 0;
    transition: opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .backdrop video.on {
    opacity: 0.5;
  }

  .scrim {
    background: linear-gradient(to top, rgb(0 0 0 / 0.85), rgb(0 0 0 / 0.2) 70%);
  }

  .words {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3);
  }

  .words :global(.page-heading) {
    color: #fff;
  }

  p {
    margin: 0;
    max-width: 48ch;
    font-size: var(--ui-text-md);
    color: rgb(255 255 255 / 0.78);
  }

  @media (prefers-reduced-motion: reduce) {
    .backdrop video {
      transition: none;
    }
  }

  @media (max-width: 640px) {
    .hero {
      min-height: 220px;
      padding: var(--ui-space-6) var(--ui-space-4);
    }
  }
</style>
