<script lang="ts">
  import { CANVAS_VIDEO } from '../home';
  import { lazyPlay } from '../lazy-video';
  import UrlField from './UrlField.svelte';
</script>

<section class="start">
  <div class="text">
    <h2 data-agent-id="start-title">Start from any site</h2>
    <p data-agent-id="start-lead">Every layer, colour and font comes in editable - colours become variables, type becomes styles, all bound.</p>
    <div class="field">
      <UrlField id="start-url" />
    </div>
  </div>

  <video data-agent-id="start-video" data-src={CANVAS_VIDEO} poster="/site/home/canvas-poster.webp" muted loop playsinline preload="none" width="1920" height="1080" aria-label="A website rebuilt as editable layers on the Feega canvas" use:lazyPlay></video>
</section>

<style>
  .start {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: center;
    gap: 40px;
    color: var(--site-ink);
  }

  h2 {
    font-size: 24px;
    line-height: 28.8px;
    letter-spacing: -0.04em;
    font-weight: 400;
    text-align: center;
  }

  p {
    margin-top: 11px;
    opacity: 0.8;
  }

  .field {
    margin-top: 12px;
  }

  video {
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 8px;
    object-fit: cover;
  }

  @media (min-width: 810px) {
    h2 {
      font-size: 30px;
      line-height: 36px;
      text-align: left;
    }

    p {
      margin-top: 24px;
    }

    .field {
      margin-top: 24px;
    }
  }

  @media (min-width: 1200px) {
    h2 {
      font-size: 38px;
      line-height: 45.6px;
    }
  }
</style>
