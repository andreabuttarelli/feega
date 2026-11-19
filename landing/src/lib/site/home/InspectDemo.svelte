<script lang="ts">
  import { onMount } from 'svelte';
  import { lazyPlay } from '../lazy-video';

  const VIDEO = '/video/feega-inspect.mp4';
  const VIDEO_WEBM = '/video/feega-inspect.webm';
  const POSTER = '/video/feega-inspect-poster.webp';
  const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

  const WEBM_TYPE = 'video/webm; codecs="vp9"';

  let video = $state<HTMLVideoElement>();
  let reduced = $state(false);
  let source = $state(VIDEO);
  let playing = $state(false);

  onMount(() => {
    reduced = matchMedia(REDUCED_QUERY).matches;
    source = document.createElement('video').canPlayType(WEBM_TYPE) ? VIDEO_WEBM : VIDEO;
  });

  function play() {
    if (!video) {
      return;
    }

    video.src ||= source;
    playing = true;
    video.play().catch(() => {});
  }
</script>

<section class="inspect-demo" aria-label="Feega Inspect in VS Code">
  {#if reduced}
    <video bind:this={video} muted loop playsinline preload="none" poster={POSTER} width="1920" height="1080" controls={playing} aria-label="Feega Inspect editing a landing page inside VS Code"></video>
    {#if !playing}
      <button type="button" class="play" onclick={play} aria-label="Play the video">
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
      </button>
    {/if}
  {:else}
    <video bind:this={video} data-src={source} muted loop playsinline preload="none" poster={POSTER} width="1920" height="1080" aria-label="Feega Inspect editing a landing page inside VS Code" use:lazyPlay></video>
  {/if}
</section>

<style>
  .inspect-demo {
    position: relative;
    max-width: 1100px;
    margin: 64px auto 0;
    padding: 0 20px;
  }

  video {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 16 / 9;
    border-radius: 6px;
    background: #1f1f1f;
  }

  .play {
    position: absolute;
    inset: 0;
    margin: auto;
    width: 64px;
    height: 64px;
    border: 0;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    cursor: pointer;
  }

  @media (max-width: 809.98px) {
    .inspect-demo {
      margin-top: 40px;
      padding: 0 16px;
    }
  }
</style>
