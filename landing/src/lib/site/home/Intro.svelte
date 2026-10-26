<script lang="ts">
  import { onMount } from 'svelte';
  import Embed from './Embed.svelte';
  import Hero from './Hero.svelte';
  import { MOTION_EMBED_ID, SHOWCASE_NARROW, SHOWCASE_WIDE, type ShowcaseVideo } from '../home';

  const NEAR_VIEWPORT = '400px';

  function lazyPlay(video: HTMLVideoElement) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          video.pause();
          return;
        }

        video.src ||= video.dataset.src ?? '';
        video.play().catch(() => {});
      },
      { rootMargin: NEAR_VIEWPORT }
    );
    observer.observe(video);

    return { destroy: () => observer.disconnect() };
  }

  const WIDE_QUERY = '(min-width: 1200px)';

  let columns = $state.raw(SHOWCASE_WIDE);

  onMount(() => {
    const media = window.matchMedia(WIDE_QUERY);
    const pick = () => (columns = media.matches ? SHOWCASE_WIDE : SHOWCASE_NARROW);
    pick();
    media.addEventListener('change', pick);
    return () => media.removeEventListener('change', pick);
  });

  const MOTION = `<feega-motion src="${MOTION_EMBED_ID}"></feega-motion>`;
</script>

{#snippet column(videos: readonly ShowcaseVideo[])}
  <div class="site-col">
    {#each videos as v (v.file)}
      <video data-src={v.file} style:aspect-ratio={v.aspect} muted loop playsinline preload="none" use:lazyPlay></video>
    {/each}
  </div>
{/snippet}

<Hero />

<div class="fade">
  <div class="site-shot">
    <img src="/site/home/screenshot.webp" alt="The feega motion editor" width="1600" height="1039" loading="lazy" decoding="async" />
  </div>

  <h2 class="claim">Like an autopilot for motion.<br />Less tokens, higher quality</h2>

  <section class="grid" id="showcase" aria-label="Showcase" style:grid-template-columns="repeat({columns.length}, 1fr)">
    {#each columns as videos, i (i)}
      {@render column(videos)}
    {/each}
  </section>
</div>

<section class="motion" id="canvas">
  <Embed title="An interactive feega motion" script="/embed.js" body={MOTION} />
  <h2>A video or an interactive experience? You can do both.</h2>
</section>

<style>
  .fade {
    padding: 0 20px 100px;
    background: #141414;
  }

  .site-shot {
    position: relative;
    overflow: hidden;
    background: #000;
    aspect-ratio: 335 / 217;
    border-radius: 10px;
  }

  .site-shot img {
    position: absolute;
    left: 8px;
    top: 1px;
    width: calc(100% - 16px);
    height: 95.4%;
    object-fit: cover;
  }

  .claim {
    margin-top: 110px;
    color: #fff;
    font-size: 72px;
    line-height: 0.9;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .grid {
    display: grid;
    gap: 8px;
    margin-top: 42px;
    align-items: start;
  }

  .site-col {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  video {
    display: block;
    width: 100%;
    object-fit: cover;
    background: #000;
  }

  .motion {
    position: relative;
    height: 600px;
  }

  .motion h2 {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 20px;
    color: #fff;
    text-align: center;
    font-size: 37px;
    line-height: 1;
    letter-spacing: -0.04em;
    font-weight: 400;
    pointer-events: none;
  }

  @media (min-width: 1200px) {
    .fade {
      padding-bottom: 99px;
      background: #141414;
    }

    .site-shot {
      max-width: 1300px;
      margin: 0 auto;
      aspect-ratio: 1300 / 822;
      border-radius: 12px;
    }

    .site-shot img {
      top: -16px;
      height: 101.22%;
    }

    .claim {
      max-width: 1160px;
      margin: 210px auto 0;
      padding-right: 295px;
      font-size: 112px;
    }

    .grid {
      margin-top: 74px;
    }

    .motion {
      height: 900px;
    }

    .motion h2 {
      max-width: 1160px;
      margin: 0 auto;
      padding: 0;
      font-size: 78px;
      line-height: 0.9;
    }
  }
</style>
