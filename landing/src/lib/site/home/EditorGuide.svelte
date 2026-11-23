<script lang="ts">
  import { lower } from '../lower';
  import { GUIDE_COPY, GUIDE_FEATURES } from '../editor-guide';
  import MockCrop from '../editor-guide/mock/MockCrop.svelte';
</script>

<section class="guide site-wide" id="editor-guide" aria-labelledby="guide-title">
  <header class="band">
    <p class="eyebrow">{lower(GUIDE_COPY.eyebrow)}</p>
    <h2 id="guide-title">{lower(GUIDE_COPY.heading)}</h2>
    <p class="lead">{lower(GUIDE_COPY.lead)}</p>
  </header>

  <ul class="features">
    {#each GUIDE_FEATURES as feature (feature.id)}
      <li class="feature" data-feature={feature.id}>
        <figure class="visual">
          <div class="box" aria-hidden="true"><MockCrop id={feature.id} /></div>
          <figcaption class="sr">{feature.alt}</figcaption>
        </figure>
        <div class="copy">
          <h3>{lower(feature.title)}</h3>
          <p class="text">{lower(feature.text)}</p>
          <p class="lands">{lower(GUIDE_COPY.landsLabel)}</p>
          <ul class="code">
            {#each feature.lands as line (line)}<li><code>{line}</code></li>{/each}
          </ul>
        </div>
      </li>
    {/each}
  </ul>
</section>

<style>
  .guide {
    padding: var(--site-section) var(--site-gutter);
    box-sizing: border-box;
    color: var(--site-ink);
  }

  p,
  h2,
  h3 {
    margin: 0;
  }

  .band {
    width: 100vw;
    margin: 0 calc(50% - 50vw) 32px;
    padding: 200px var(--site-gutter) 72px;
    box-sizing: border-box;
    text-align: center;
    background:
      linear-gradient(180deg, rgb(0 0 0 / 0.1) 0%, rgb(0 0 0 / 0.45) 45%, var(--site-bg) 100%),
      url('/img/pixel-band.png') center top / cover no-repeat;
    image-rendering: pixelated;
  }

  .band .lead {
    max-width: 560px;
    margin-inline: auto;
  }

  .eyebrow {
    color: #ff8a3d;
  }

  h2 {
    margin-top: 16px;
    font-size: 34px;
    line-height: 36px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .lead {
    margin-top: 16px;
    opacity: 0.85;
  }

  .features {
    display: grid;
    gap: 48px;
    margin: 24px 0 0;
    padding: 0;
    list-style: none;
  }

  .feature {
    min-width: 0;
  }

  .visual {
    margin: 0 0 20px;
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    white-space: nowrap;
    clip-path: inset(50%);
  }

  h3 {
    font-size: 22px;
    line-height: 26px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .text {
    margin-top: 8px;
    opacity: 0.7;
  }

  .lands {
    margin-top: 16px;
    font-size: 14px;
    opacity: 0.5;
  }

  .code {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }

  code {
    display: inline-block;
    max-width: 100%;
    padding: 4px 8px;
    overflow-wrap: anywhere;
    border-radius: 4px;
    background: var(--sx-pill);
    font-family: var(--sx-mono);
    font-size: 13px;
  }

  @media (min-width: 810px) {
    .guide {
      padding-inline: 0;
    }

    .band {
      padding: 280px 24px 96px;
      margin-bottom: 56px;
    }

    h2 {
      font-size: 40px;
      line-height: 42px;
    }
  }

  @media (min-width: 900px) {
    .features {
      gap: 108px;
      margin-top: 0;
    }

    .feature {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 520px);
      grid-template-areas: 'copy visual';
      gap: 64px;
      align-items: center;
    }

    .feature:nth-child(even) {
      grid-template-columns: minmax(0, 520px) minmax(0, 1fr);
      grid-template-areas: 'visual copy';
    }

    .visual {
      grid-area: visual;
      margin: 0;
    }

    .copy {
      grid-area: copy;
    }

    .box {
      height: 360px;
    }
  }
</style>
