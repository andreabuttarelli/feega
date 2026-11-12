<script lang="ts">
  import { CANVAS_VIDEO } from '../home';
  import { lazyPlay } from '../lazy-video';
  import UrlField from './UrlField.svelte';
</script>

<section class="start">
  <div class="text">
    <h3 data-agent-id="start-title">Start from any site</h3>
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
    align-items: center;
    gap: 32px;
    color: var(--site-ink);
  }

  h3 {
    font-size: 22px;
    line-height: 26px;
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
    .start {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 40px;
    }

    h3 {
      font-size: 26px;
      line-height: 30px;
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
    h3 {
      font-size: 30px;
      line-height: 36px;
    }
  }
</style>
