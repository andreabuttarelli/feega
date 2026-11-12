<script lang="ts">
  import { TICKER_VIDEOS } from '../home';
  import { lazyPlay } from '../lazy-video';
  import { inView } from '../iso/in-view';

  const HALF = Math.ceil(TICKER_VIDEOS.length / 2);
  const ROWS = [TICKER_VIDEOS.slice(0, HALF), TICKER_VIDEOS.slice(HALF)];
  const COPIES = [0, 1];
  const MANUAL = 'data-manual';

  function takeOver(e: Event) {
    const row = e.currentTarget as HTMLElement;
    if (row.hasAttribute(MANUAL)) {
      return;
    }

    if (e instanceof WheelEvent && Math.abs(e.deltaX) <= Math.abs(e.deltaY)) {
      return;
    }

    const track = row.firstElementChild as HTMLElement;
    const shift = -new DOMMatrix(getComputedStyle(track).transform).m41;
    row.setAttribute(MANUAL, '');
    row.scrollLeft = shift;
  }
</script>

<div class="ticker" data-agent-id="motion-ticker" use:inView>
  {#each ROWS as videos, r (r)}
    <div class="row" class:reverse={r === 1} role="region" aria-label="Videos made with Feega, row {r + 1}" onpointerdown={takeOver} onfocus={takeOver} onwheel={takeOver}>
      <div class="track">
        {#each COPIES as copy (copy)}
          {#each videos as src (src)}
            <video class:copy={copy === 1} aria-hidden={copy === 1 ? 'true' : undefined} data-src={src} muted loop playsinline preload="none" width="1920" height="1080" use:lazyPlay></video>
          {/each}
        {/each}
      </div>
    </div>
  {/each}
</div>

<style>
  .ticker {
    --tile: 110px;
    --gap: 8px;
    --cycle: 70s;

    display: grid;
    gap: var(--gap);
    mask-image: linear-gradient(to right, transparent, #000 8%, #000 92%, transparent);
  }

  .row {
    overflow-x: auto;
    scrollbar-width: none;
    outline-offset: 4px;
  }

  .row::-webkit-scrollbar {
    display: none;
  }

  .track {
    display: flex;
    width: max-content;
    animation: marquee var(--cycle) linear infinite;
  }

  .reverse .track {
    animation-direction: reverse;
    animation-duration: calc(var(--cycle) * 1.2);
  }

  .ticker:is(:hover, :focus-within) .track,
  .ticker:global([data-paused]) .track {
    animation-play-state: paused;
  }

  .row:global([data-manual]) {
    scroll-snap-type: x mandatory;
  }

  .row:global([data-manual]) .track {
    animation: none;
  }

  video {
    flex: none;
    width: auto;
    height: var(--tile);
    aspect-ratio: 16 / 9;
    margin-right: var(--gap);
    object-fit: cover;
    background: #111;
    scroll-snap-align: start;
  }

  @keyframes marquee {
    to {
      transform: translateX(-50%);
    }
  }

  @media (min-width: 810px) {
    .ticker {
      --tile: 150px;
    }
  }

  @media (min-width: 1200px) {
    .ticker {
      --tile: 180px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .row {
      scroll-snap-type: x mandatory;
    }

    .track {
      animation: none;
    }

    .copy {
      display: none;
    }
  }
</style>
