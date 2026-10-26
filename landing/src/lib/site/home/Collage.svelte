<script lang="ts">
  import { COLLAGE, COLLAGE_STAGE } from '../home';
  import { lazyPlay } from '../lazy-video';

  const NEAR_VIEWPORT = '200px';

  let live = $state(false);

  function whenNear(node: HTMLElement) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          return;
        }

        live = true;
        observer.disconnect();
      },
      { rootMargin: NEAR_VIEWPORT }
    );
    observer.observe(node);

    return { destroy: () => observer.disconnect() };
  }

  const cqw = (px: number) => `${(px / COLLAGE_STAGE.width) * 100}cqw`;
</script>

<section class="collage" id="showcase" aria-label="Showcase">
  <div class="stage" use:whenNear>
    {#each live ? COLLAGE : [] as t (t.file)}
      <div class="tile" style:left={cqw(t.x)} style:top={cqw(t.y)} style:width={cqw(t.w)} style:height={cqw(t.h)}>
        {#if t.kind === 'image'}
          <img src="/site/home/{t.file}.webp" alt="" loading="lazy" decoding="async" />
        {:else}
          <video data-src={t.file} muted loop playsinline preload="none" aria-hidden="true" use:lazyPlay></video>
        {/if}
      </div>
    {/each}
  </div>
</section>

<style>
  .collage {
    overflow: hidden;
    padding: 40px 0 0;
  }

  .stage {
    container-type: inline-size;
    position: relative;
    width: max(100%, 800px);
    left: 50%;
    transform: translateX(-50%);
    aspect-ratio: 1440 / 900;
  }

  .tile {
    position: absolute;
    overflow: hidden;
    border-radius: 1cqw;
    background: #000;
  }

  img,
  video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
