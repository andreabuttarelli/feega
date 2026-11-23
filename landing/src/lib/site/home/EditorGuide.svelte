<script lang="ts">
  import { onMount } from 'svelte';
  import { lower } from '../lower';
  import { GUIDE_COPY, GUIDE_FEATURES } from '../editor-guide';

  const CENTRE_LINE = '-50% 0px -50% 0px';

  let active = $state(0);
  let items: HTMLLIElement[] = [];

  onMount(() => {
    const watcher = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            active = items.indexOf(entry.target as HTMLLIElement);
          }
        });
      },
      { rootMargin: CENTRE_LINE }
    );

    items.forEach((item) => watcher.observe(item));

    return () => watcher.disconnect();
  });
</script>

<section class="guide site-wide" id="editor-guide" aria-labelledby="guide-title">
  <p class="eyebrow">{lower(GUIDE_COPY.eyebrow)}</p>
  <h2 id="guide-title">{lower(GUIDE_COPY.heading)}</h2>
  <p class="lead">{lower(GUIDE_COPY.lead)}</p>

  <div class="scroller">
    <ul class="features">
      {#each GUIDE_FEATURES as feature, index (feature.id)}
        <li class="feature" class:on={index === active} data-feature={feature.id} bind:this={items[index]}>
          <img
            class="inline"
            src={feature.src}
            alt={feature.alt}
            width={feature.width}
            height={feature.height}
            loading="lazy"
            decoding="async"
          />
          <h3>{lower(feature.title)}</h3>
          <p class="text">{lower(feature.text)}</p>
          <p class="lands">{lower(GUIDE_COPY.landsLabel)}</p>
          <ul class="code">
            {#each feature.lands as line (line)}<li><code>{line}</code></li>{/each}
          </ul>
        </li>
      {/each}
    </ul>

    <div class="stage" aria-hidden="true">
      <div class="shots">
        {#each GUIDE_FEATURES as feature, index (feature.id)}
          <img class:on={index === active} src={feature.src} alt="" width={feature.width} height={feature.height} loading="lazy" decoding="async" />
        {/each}
      </div>
    </div>
  </div>
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
    gap: 48px;
    margin: 48px 0 0;
    padding: 0;
    list-style: none;
  }

  .feature {
    min-width: 0;
  }

  .inline {
    display: block;
    width: auto;
    max-width: 100%;
    height: auto;
    max-height: 320px;
    margin-bottom: 20px;
    padding: 16px;
    box-sizing: border-box;
    border-radius: 12px;
    background: #0d0d0d;
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

  .stage {
    display: none;
  }

  @media (min-width: 810px) {
    h2 {
      font-size: 40px;
      line-height: 42px;
    }
  }

  @media (min-width: 900px) {
    .scroller {
      display: grid;
      grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
      gap: 48px;
      align-items: start;
    }

    .features {
      gap: 0;
      margin-top: 0;
    }

    .feature {
      position: relative;
      display: flex;
      min-height: 62vh;
      flex-direction: column;
      justify-content: center;
      opacity: 0.3;
      transition: opacity 0.35s;
    }

    .feature.on {
      opacity: 1;
    }

    .inline {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      padding: 0;
      overflow: hidden;
      clip-path: inset(50%);
    }

    .stage {
      position: sticky;
      top: calc(50vh - 260px);
      display: block;
    }

    .shots {
      display: grid;
      grid-template: minmax(0, 1fr) / minmax(0, 1fr);
      place-items: center;
      height: 520px;
      padding: 24px;
      border-radius: 12px;
      background: #0d0d0d;
    }

    .shots img {
      grid-area: 1 / 1;
      display: block;
      width: auto;
      max-width: 100%;
      height: auto;
      max-height: 100%;
      border-radius: 8px;
      opacity: 0;
      transition: opacity 0.4s;
    }

    .shots img.on {
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .feature,
    .shots img {
      transition: none;
    }
  }
</style>
