<script lang="ts">
  import { CODE_VIDEO } from '../home';
  import { lazyPlay } from '../lazy-video';
</script>

<section class="switch">
  <div class="site-wide inner">
    <div class="pair providers">
      <div class="text">
        <p class="small warn">No lock-ins</p>
        <h2>Switch between different providers</h2>
        <p class="small">Bring your own models: OpenRouter, ElevenLabs and more.</p>
      </div>
      <img src="/site/home/providers.webp" alt="A Feega node picking the cheapest provider for a run" width="1328" height="778" loading="lazy" decoding="async" />
    </div>

    <div class="pair code">
      <video data-src={CODE_VIDEO} poster="/site/home/code-poster.webp" muted loop playsinline preload="none" width="1920" height="1080" aria-label="Exporting a Feega design to code" use:lazyPlay></video>
      <div class="text">
        <p class="small warn">Warning - Only for real nerds</p>
        <h2>Ship it as video or code.</h2>
        <p class="small">MP4 in every format, or React, Svelte and HTML.</p>
      </div>
    </div>
  </div>
</section>

<style>
  .switch {
    background: #000;
    color: #fff;
  }

  .inner {
    padding: 100px 12px;
  }

  h2 {
    font-size: 37px;
    line-height: 37px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .small {
    margin-top: 32px;
  }

  .warn {
    margin: 0 0 32px;
    color: #ff5100;
  }

  .code .small {
    margin-top: 24px;
  }

  .code .warn {
    margin: 0 0 24px;
  }

  .code {
    margin-top: 80px;
  }

  .providers img {
    margin-top: 48px;
  }

  .code .text {
    margin-top: 48px;
  }

  .pair img,
  .pair video {
    width: 100%;
    object-fit: cover;
  }

  .pair img {
    aspect-ratio: 366 / 214;
  }

  .pair video {
    aspect-ratio: 16 / 9;
    border-radius: 8px;
  }

  @media (min-width: 810px) {
    .pair {
      display: grid;
      justify-content: space-between;
      align-items: center;
    }

    .providers img,
    .code .text {
      margin-top: 0;
    }
  }

  @media (min-width: 1200px) {
    .inner {
      padding: 72px 0 200px;
    }

    .pair {
      grid-template-columns: 520px 520px;
    }

    .code {
      margin-top: 96px;
    }

    h2 {
      font-size: 58px;
      line-height: 58px;
    }

    .pair img {
      aspect-ratio: 520 / 305;
    }

    .pair video {
      aspect-ratio: 520 / 291;
    }
  }

  @media (min-width: 810px) and (max-width: 1199.98px) {
    .inner {
      padding: 150px 0;
    }

    .pair {
      grid-template-columns: 379px 379px;
    }

    h2 {
      font-size: 46px;
      line-height: 46px;
    }

    .pair img {
      aspect-ratio: 379 / 222;
    }

    .pair video {
      aspect-ratio: 379 / 212;
    }
  }
</style>
