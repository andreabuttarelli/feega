<script lang="ts">
  import { APP_URL } from '../links';
  import { CODE_VIDEO, MODEL_ROWS } from '../home';
  import { lazyPlay } from '../lazy-video';

  const SMALL_GAP = 'calc(21.05px - 2.5cqw)';
  const BIG_GAP = 'calc(14.95px + 2.5cqw)';
  const LAST_GAP = 'calc(33.05px - 2.5cqw)';

  const PHONE_LAYOUT: readonly (readonly [string, string])[] = [
    ['1 / 3', SMALL_GAP],
    ['3 / 5', SMALL_GAP],
    ['1 / 3', BIG_GAP],
    ['3 / 5', BIG_GAP],
    ['1 / 3', SMALL_GAP],
    ['3 / 5', SMALL_GAP],
    ['2 / 4', BIG_GAP],
    ['1 / 3', LAST_GAP],
    ['3 / 5', LAST_GAP],
    ['1 / 3', '0px'],
    ['3', '0px'],
    ['4', '0px']
  ];

  const tiles = MODEL_ROWS.flatMap((row, r) => row.map((m) => ({ ...m, row: r + 1 }))).map((m, i) => ({
    ...m,
    phone: PHONE_LAYOUT[i][0],
    gap: PHONE_LAYOUT[i][1]
  }));
</script>

<section class="switch">
  <div class="site-wide inner">
    <div class="pair">
      <div class="text">
        <h2>Switch between different providers</h2>
        <p class="small">OpenRouter • Kie • Higgsfield • Wiro • ElevenLabs</p>
      </div>
      <img src="/site/home/providers.webp" alt="A Feega node picking the cheapest provider for a run" width="1328" height="778" loading="lazy" decoding="async" />
    </div>

    <div class="tiles">
      {#each tiles as t, i (i)}
        <a class="tile" class:first={t.row === 1} href={APP_URL} style:--col={t.col} style:--row={t.row} style:--phone={t.phone} style:--gap={t.gap}>
          <span class="label">
            <span class="view" aria-hidden="true">View →</span>
            <span class="name">{t.name}</span>
          </span>
          <span class="pic"><img src="/site/home/model-{t.slug}.webp" alt="" width="800" height="1000" loading="lazy" decoding="async" /></span>
        </a>
      {/each}
    </div>

    <div class="pair code">
      <div class="text">
        <p class="small warn">Warning - Only for real nerds</p>
        <h2>Design → Code in one click</h2>
        <p class="small">Export in HTML, React, and even Svelte</p>
      </div>
      <video data-src={CODE_VIDEO} poster="/site/home/code-poster.webp" muted loop playsinline preload="none" width="1920" height="1080" aria-label="Exporting a Feega design to code" use:lazyPlay></video>
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

  .code .small {
    margin-top: 24px;
  }

  .code .warn {
    margin: 0 0 24px;
    color: #ff5100;
  }

  .pair img,
  .pair video {
    width: 100%;
    margin-top: 48px;
    object-fit: cover;
  }

  .pair img {
    aspect-ratio: 366 / 214;
  }

  .pair video {
    aspect-ratio: 16 / 9;
    border-radius: 8px;
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    column-gap: 12px;
    margin: 80px 0 190px;
    padding: 12px 12px 0;
    container-type: inline-size;
  }

  .tile {
    grid-column: var(--phone);
    align-self: start;
    aspect-ratio: 1 / 1.1;
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-bottom: var(--gap);
    font-size: 12px;
    line-height: 12px;
    letter-spacing: -0.02em;
  }

  .label {
    position: relative;
    display: block;
    height: 12px;
  }

  .view {
    position: absolute;
    left: 0;
    bottom: 20px;
    opacity: 0;
    color: var(--site-ink);
    transition:
      opacity 0.3s ease,
      transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .tile:hover .view {
    opacity: 1;
    transform: translateY(20px);
  }

  .name {
    display: block;
    transition: opacity 0.3s ease;
  }

  .tile:hover .name {
    opacity: 0;
  }

  .pic {
    display: block;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .pic img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scale(1.1);
    transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .tile:hover img {
    transform: scale(1);
  }

  @media (min-width: 1200px) {
    .inner {
      padding: 200px 0;
    }

    .pair {
      display: grid;
      grid-template-columns: 520px 520px;
      justify-content: space-between;
      align-items: center;
    }

    h2 {
      font-size: 58px;
      line-height: 58px;
    }

    .pair img,
    .pair video {
      margin-top: 0;
    }

    .pair img {
      aspect-ratio: 520 / 305;
    }

    .pair video {
      aspect-ratio: 520 / 291;
    }

    .tiles {
      grid-template-columns: repeat(7, minmax(0, 1fr));
      column-gap: 19.5px;
      row-gap: 104.33px;
      margin: 96px 0 216px;
      padding: 20px 20px 0;
    }

    .tile {
      grid-column: var(--col);
      grid-row: var(--row);
      margin-bottom: 0;
    }

    .tile {
      aspect-ratio: auto;
    }

    .pic {
      flex: none;
      aspect-ratio: 129 / 124;
    }
  }

  @media (min-width: 810px) and (max-width: 1199.98px) {
    .inner {
      padding: 150px 0;
    }

    .pair {
      display: grid;
      grid-template-columns: 379px 379px;
      justify-content: space-between;
      align-items: center;
    }

    h2 {
      font-size: 46px;
      line-height: 46px;
    }

    .pair img,
    .pair video {
      margin-top: 0;
    }

    .pair img {
      aspect-ratio: 379 / 222;
    }

    .pair video {
      aspect-ratio: 379 / 212;
    }

    .tiles {
      grid-template-columns: repeat(7, minmax(0, 1fr));
      column-gap: 15.8px;
      row-gap: 88.5px;
      margin: 80px 0 246px;
      padding: 16px 16px 0;
    }

    .tile {
      grid-column: var(--col);
      grid-row: var(--row);
      aspect-ratio: auto;
      margin-bottom: 0;
    }

    .tile.first {
      margin-bottom: 37.5px;
    }

    .pic {
      flex: none;
      aspect-ratio: 93 / 85;
    }
  }
</style>
