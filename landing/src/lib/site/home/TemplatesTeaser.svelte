<script lang="ts">
  import { lower } from '../lower';
  import { TEASER_COPY, TEASER_CTA, TEASER_EYEBROW, teaserShots, teaserTitle } from './templates-teaser';

  let { count }: { count: number } = $props();

  const shots = teaserShots();
</script>

<section class="teaser site-wide" aria-labelledby="teaser-title">
  <p class="eyebrow">{lower(TEASER_EYEBROW)}</p>
  <h2 id="teaser-title" data-agent-id="templates-title">{lower(teaserTitle())}</h2>
  <p class="copy">{lower(TEASER_COPY)}</p>

  <ul class="shots">
    {#each shots as shot (shot.id)}
      <li>
        <a href={shot.href}>
          <img src={shot.src} alt={shot.alt} width={shot.width} height={shot.height} loading="lazy" decoding="async" />
          <span>{lower(shot.name)}</span>
        </a>
      </li>
    {/each}
  </ul>

  <a class="site-pill cta" href={TEASER_CTA.href}>{TEASER_CTA.label}</a>
</section>

<style>
  .teaser {
    padding: 0 12px var(--site-section);
    color: var(--site-ink);
  }

  .eyebrow {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    font-family: 'Fragment Mono', monospace;
    font-size: 13px;
    letter-spacing: 0;
  }

  .eyebrow::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: var(--ui-radius-xs, 2px);
    background: #ff5100;
  }

  h2 {
    max-width: 900px;
    margin: 16px 0 0;
    text-wrap: balance;
    font-size: 34px;
    line-height: 36px;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .copy {
    max-width: 640px;
    margin: 16px 0 0;
    opacity: 0.7;
  }

  .shots {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin: 40px 0 0;
    padding: 0;
    list-style: none;
  }

  .shots a {
    display: grid;
    gap: 8px;
    color: inherit;
    text-decoration: none;
  }

  .shots img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 8px;
    background: #f5f4f0;
  }

  .shots a:focus-visible {
    outline: 2px solid #ff5100;
    outline-offset: 3px;
  }

  .shots span {
    font-size: 14px;
    opacity: 0.7;
  }

  .cta {
    width: auto;
    margin-top: 32px;
    padding: 0 28px;
  }

  @media (min-width: 810px) {
    .teaser {
      padding: 0 0 var(--site-section);
    }

    h2 {
      font-size: 40px;
      line-height: 42px;
    }

    .shots {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 16px;
    }
  }

  @media (min-width: 1200px) {
    h2 {
      font-size: 48px;
      line-height: 50px;
    }
  }
</style>
