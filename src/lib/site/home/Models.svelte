<script lang="ts">
  import { APP_URL } from '../links';
  import { FEATURED_MODELS, MODEL_ROWS } from '../home';

  const PHONE_LAYOUT: readonly (readonly [string, number])[] = [
    ['1 / 3', 12],
    ['3 / 5', 12],
    ['1 / 3', 24],
    ['3 / 5', 24],
    ['1 / 3', 12],
    ['3 / 5', 12],
    ['2 / 4', 24],
    ['1 / 3', 24],
    ['3 / 5', 24],
    ['1 / 3', 0],
    ['3', 0],
    ['4', 0]
  ];

  const tiles = MODEL_ROWS.flatMap((row, r) => row.map((m) => ({ ...m, row: r + 1 }))).map((m, i) => ({
    ...m,
    phone: PHONE_LAYOUT[i][0],
    gap: `${PHONE_LAYOUT[i][1]}px`
  }));
</script>

<section class="models" id="models">
  <div class="site-wrap">
    <div class="head">
      <h2>Powered by the best models</h2>
      <p>Text, image, video, audio models.<br />The largest model catalog on Earth.</p>
      <p class="right">Switch seamlessly <br />between models.</p>
    </div>

    <div class="featured">
      {#each FEATURED_MODELS as m (m.slug)}
        <a class="site-feature" href="/work/{m.slug}">
          <img src="/site/home/model-{m.slug}.webp" alt={m.name} width="1122" height="1402" loading="lazy" />
          <span class="model-name">{m.name}</span>
          <span>{m.maker}</span>
        </a>
      {/each}
    </div>

    <a class="try" href={APP_URL}>Try them in app</a>

    <div class="tiles">
      {#each tiles as t (t.slug)}
        <a class="model-tile" href="/work/{t.slug}" style:--col={t.col} style:--row={t.row} style:--phone={t.phone} style:--gap={t.gap}>
          <span>{t.name}</span>
          <span class="pic"><img src="/site/home/model-{t.slug}.webp" alt="" width="800" height="1000" loading="lazy" /></span>
        </a>
      {/each}
    </div>
  </div>
</section>

<style>
  .models {
    padding: 100px 0 0;
  }

  .site-wrap {
    max-width: 430px;
    margin: 0 auto;
    padding: 0 12px;
  }

  h2 {
    font-size: 50px;
    line-height: 0.9;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .head p {
    margin-top: 48px;
  }

  .head .right {
    margin-top: 23px;
  }

  .featured {
    display: grid;
    gap: 48px;
    margin-top: 80px;
  }

  .site-feature {
    display: flex;
    flex-direction: column;
  }

  .site-feature img {
    width: 100%;
    height: 401px;
    object-fit: cover;
    margin-bottom: 10px;
  }

  .site-feature .model-name {
    margin-bottom: 5px;
  }

  .try {
    display: block;
    width: fit-content;
    margin: 80px 0 0 calc(50% + 6px);
    font-size: 24px;
    line-height: 1.2;
    letter-spacing: -0.04em;
    border-bottom: 2px solid var(--site-ink);
  }

  .tiles {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    column-gap: 11px;
    margin-top: 80px;
    padding: 12px 12px 212px;
  }

  .model-tile {
    grid-column: var(--phone);
    align-self: start;
    margin-bottom: var(--gap);
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-size: 12px;
    line-height: 1;
  }

  .pic {
    display: block;
    overflow: hidden;
    aspect-ratio: 1;
  }

  .pic img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scale(1.1);
    transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .model-tile:hover img {
    transform: scale(1);
  }

  @media (min-width: 1200px) {
    .models {
      padding-top: 200px;
    }

    .site-wrap {
      max-width: 1500px;
      padding: 0 20px;
    }

    .head {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 20px;
      align-items: start;
    }

    h2 {
      grid-row: 1 / 3;
      font-size: 78px;
    }

    .head p {
      grid-column: 2;
      grid-row: 1;
      margin-top: 51px;
    }

    .head .right {
      justify-self: end;
      margin-top: 51px;
    }

    .featured {
      grid-template-columns: 1fr 1fr;
      column-gap: 20px;
      align-items: start;
      margin-top: 32px;
    }

    .featured .site-feature:first-child {
      width: 65.65%;
    }

    .featured .site-feature:first-child img {
      height: 442px;
    }

    .featured .site-feature:last-child img {
      height: 757px;
    }

    .try {
      margin: 96px 0 0 calc(50% + 10px);
      font-size: 38px;
    }

    .tiles {
      grid-template-columns: repeat(7, minmax(0, 1fr));
      grid-template-rows: none;
      grid-auto-rows: auto;
      column-gap: 20px;
      row-gap: 104.67px;
      margin-top: 96px;
      padding: 20px 20px 221px;
    }

    .model-tile {
      grid-column: var(--col);
      grid-row: var(--row);
      margin-bottom: 0;
    }
  }
</style>
