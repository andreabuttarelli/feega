<script lang="ts">
  import { lower } from '../lower';
  import { eventAttrs } from '../analytics/attrs';
  import { alternativePath } from '../alternatives';
  import { CHECKED_LABEL, FULL_COMPARISON_LABEL } from './index';
  import type { Variant } from './variant';

  let { variant }: { variant: Variant } = $props();
</script>

<section class="strip site-wide" aria-labelledby="strip-title">
  <h2 id="strip-title">{lower(`${variant.tool} and Feega with ${variant.agent}, side by side`)}</h2>

  <div class="scroll">
    <table>
      <thead>
        <tr>
          <th scope="col"><span class="sr">aspect</span></th>
          <th scope="col">{variant.tool}</th>
          <th scope="col">Feega with {variant.agent}</th>
        </tr>
      </thead>
      <tbody>
        {#each variant.strip as row (row.aspect)}
          <tr>
            <th scope="row">{lower(row.aspect)}</th>
            <td>{row.tool}</td>
            <td>{row.feega}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <p class="keep">{variant.keepTool}</p>
  <p class="more">
    <span class="date">checked {CHECKED_LABEL}</span>
    <a href={alternativePath(variant.slug)} {...eventAttrs('alt_landing_cta', { page: variant.slug, cta: 'full_comparison' })}>{FULL_COMPARISON_LABEL} →</a>
  </p>
</section>

<style>
  .strip {
    padding: var(--site-section) 12px 0;
    color: var(--site-ink);
  }

  h2 {
    margin: 0 0 32px;
    max-width: 900px;
    text-wrap: balance;
    font-size: 30px;
    line-height: 1.05;
    letter-spacing: -0.04em;
    font-weight: 400;
  }

  .scroll {
    overflow-x: auto;
  }

  table {
    width: 100%;
    min-width: 640px;
    border-collapse: collapse;
    text-align: left;
    font-size: 15px;
    line-height: 1.4;
  }

  th,
  td {
    padding: 16px 16px 16px 0;
    border-top: 1px solid rgba(240, 238, 233, 0.2);
    vertical-align: top;
  }

  thead th {
    border-top: 0;
    font-weight: 400;
    opacity: 0.5;
  }

  tbody th {
    width: 18%;
    font-weight: 400;
    opacity: 0.6;
  }

  td:last-child {
    color: #fff;
  }

  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }

  .keep {
    margin: 24px 0 0;
    max-width: 640px;
    opacity: 0.8;
  }

  .more {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 24px;
    margin: 16px 0 0;
  }

  .date {
    opacity: 0.5;
  }

  a {
    color: var(--site-ink);
    text-decoration: underline;
    text-underline-offset: 4px;
  }

  @media (min-width: 810px) {
    .strip {
      padding-inline: 0;
    }

    h2 {
      font-size: 40px;
    }
  }
</style>
