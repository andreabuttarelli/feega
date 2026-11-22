<script lang="ts">
  import { lower } from '../lower';
  import type { Variant } from './variant';

  let { variant }: { variant: Variant } = $props();
</script>

<section class="diffs site-wide" aria-labelledby="diffs-title">
  <h2 id="diffs-title">{lower(`why ${variant.agent} users pick Feega over ${variant.tool}`)}</h2>

  <ol>
    {#each variant.differentiators as item, i (item.heading)}
      <li>
        <span class="n">0{i + 1}</span>
        <h3>{lower(item.heading)}</h3>
        <p>{item.text}</p>
      </li>
    {/each}
  </ol>
</section>

<style>
  .diffs {
    padding: var(--site-section) 12px 0;
    color: var(--site-ink);
  }

  h2 {
    margin: 0 0 40px;
    max-width: 900px;
    text-wrap: balance;
    font-size: 30px;
    line-height: 1.05;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  ol {
    display: grid;
    gap: 32px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    gap: 12px;
    align-content: start;
    padding-top: 20px;
    border-top: 1px solid rgba(240, 238, 233, 0.2);
  }

  .n {
    font-family: 'DM Mono', monospace;
    font-size: 13px;
    opacity: 0.45;
  }

  h3 {
    margin: 0;
    font-size: 24px;
    line-height: 1.1;
    letter-spacing: -0.04em;
    font-weight: 400;
    text-wrap: balance;
  }

  p {
    margin: 0;
    font-size: 15px;
    line-height: 1.5;
    opacity: 0.75;
  }

  @media (min-width: 810px) {
    .diffs {
      padding-inline: 0;
    }

    h2 {
      font-size: 40px;
    }

    ol {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 24px;
    }
  }
</style>
