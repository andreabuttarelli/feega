<script lang="ts">
  import { TICKER_VIDEOS } from '../home';
  import { lazyPlay } from '../lazy-video';
</script>

<div class="ticker" data-agent-id="motion-ticker" aria-label="Videos made with Feega">
  {#each TICKER_VIDEOS as src (src)}
    <video data-src={src} muted loop playsinline preload="none" width="1920" height="1080" use:lazyPlay></video>
  {/each}
</div>

<style>
  .ticker {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    width: 100%;
  }

  video {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
  }

  @media (min-width: 810px) {
    .ticker {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (min-width: 1200px) {
    .ticker {
      grid-template-columns: repeat(5, minmax(0, 1fr));
    }
  }
</style>
