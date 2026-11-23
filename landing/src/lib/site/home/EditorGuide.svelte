<script lang="ts">
  import { lower } from '../lower';
  import { GUIDE_COPY, GUIDE_FEATURES } from '../editor-guide';
</script>

<section class="guide site-wide" id="editor-guide" aria-labelledby="guide-title">
  <p class="eyebrow">{lower(GUIDE_COPY.eyebrow)}</p>
  <h2 id="guide-title">{lower(GUIDE_COPY.heading)}</h2>
  <p class="lead">{lower(GUIDE_COPY.lead)}</p>

  <ul class="features">
    {#each GUIDE_FEATURES as feature (feature.id)}
      <li class="feature" data-feature={feature.id}>
        <div class="shot">
          <img src={feature.src} alt={feature.alt} width={feature.width} height={feature.height} loading="lazy" decoding="async" />
        </div>
        <h3>{lower(feature.title)}</h3>
        <p class="text">{lower(feature.text)}</p>
        <p class="lands">{lower(GUIDE_COPY.landsLabel)}</p>
        <ul class="code">
          {#each feature.lands as line (line)}<li><code>{line}</code></li>{/each}
        </ul>
      </li>
    {/each}
  </ul>
</section>

<style>
  .guide {
    padding-top: var(--site-section);
    color: var(--site-ink);
  }

  p,
  h2,
  h3 {
    margin: 0;
  }

  .eyebrow {
    color: #ff5100;
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
    opacity: 0.7;
  }

  .features {
    display: grid;
    gap: 48px 32px;
    margin: 48px 0 0;
    padding: 0;
    list-style: none;
  }

  .feature {
    display: flex;
    min-width: 0;
    flex-direction: column;
  }

  .shot {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 260px;
    padding: 16px;
    border-radius: 12px;
    background: #0d0d0d;
  }

  .shot img {
    display: block;
    width: auto;
    max-width: 100%;
    height: auto;
    max-height: 340px;
    border-radius: 8px;
  }

  h3 {
    margin-top: 20px;
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
    h2 {
      font-size: 40px;
      line-height: 42px;
    }

    .features {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
