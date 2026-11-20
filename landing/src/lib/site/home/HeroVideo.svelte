<script lang="ts">
  import { onMount } from 'svelte';
  import { lazyPlay } from '../lazy-video';

  const POSTER = '/video/feega-demo-poster.webp';
  const VIDEO = '/video/feega-demo.mp4';
  const VIDEO_WEBM = '/video/feega-demo.webm';
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

<div class="hero-video" data-agent-id="hero-canvas">
  {#if reduced}
    <video bind:this={video} muted loop playsinline preload="none" poster={POSTER} width="1920" height="1080" controls={playing} aria-label="Feega editing a landing page inside VS Code"></video>
    {#if !playing}
      <button type="button" class="play" onclick={play} aria-label="Play the video">
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
      </button>
    {/if}
  {:else}
    <video bind:this={video} data-src={source} muted loop playsinline preload="none" poster={POSTER} width="1920" height="1080" aria-label="Feega editing a landing page inside VS Code" use:lazyPlay></video>
  {/if}
</div>

<style>
  .hero-video {
    position: relative;
    width: 100%;
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
</style>
