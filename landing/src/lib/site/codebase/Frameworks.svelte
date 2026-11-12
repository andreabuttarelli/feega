<script lang="ts">
  import { FRAMEWORKS, STYLE_SOURCES, TIERS } from '.';
  import { LOGO_PATHS, type Logo } from './logos';
</script>

{#snippet chip(name: string, logo: Logo)}
  <li>
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={LOGO_PATHS[logo]} /></svg>
    {name}
  </li>
{/snippet}

<div class="frameworks">
  {#each TIERS as row (row.tier)}
    <div class="row" data-tier={row.tier}>
      <div class="head">
        <p class="label">{row.label}</p>
        <p class="note">{row.note}</p>
      </div>
      <ul aria-label="{row.label} frameworks">
        {#each FRAMEWORKS.filter((f) => f.tier === row.tier) as framework (framework.name)}
          {@render chip(framework.name, framework.logo)}
        {/each}
      </ul>
    </div>
  {/each}

  <div class="row">
    <div class="head">
      <p class="label">Design tokens</p>
      <p class="note">Read from your stylesheets.</p>
    </div>
    <ul aria-label="Design token sources">
      {#each STYLE_SOURCES as source (source.name)}
        {@render chip(source.name, source.logo)}
      {/each}
    </ul>
  </div>
</div>

<style>
  .frameworks {
    display: grid;
    gap: 24px;
  }

  .row {
    display: grid;
    gap: 12px;
  }

  p {
    margin: 0;
  }

  .label {
    color: #fff;
  }

  .note {
    margin-top: 4px;
    font-size: 12px;
    line-height: 16px;
    opacity: 0.5;
  }

  ul {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 14px 0 12px;
    border-radius: 100px;
    background: #171717;
    white-space: nowrap;
  }

  [data-tier='early'] li {
    background: transparent;
    box-shadow: inset 0 0 0 1px #262626;
    color: rgba(240, 238, 233, 0.75);
  }

  svg {
    flex: none;
    width: 16px;
    height: 16px;
    fill: currentColor;
  }

  @media (min-width: 810px) {
    .row {
      grid-template-columns: 200px minmax(0, 1fr);
      gap: 24px;
      align-items: start;
    }

    .head {
      padding-top: 8px;
    }
  }
</style>
