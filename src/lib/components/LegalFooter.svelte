<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { FOOTER_LEGAL_LINKS, LEGAL_LINKS, legalHref } from '$lib/legal-links';
</script>

<p class="legal-footer">
  {#each FOOTER_LEGAL_LINKS as key, i (key)}
    {#if i > 0}<span class="dot" aria-hidden="true">·</span>{/if}
    <a href={legalHref(key)} target="_blank" rel="noopener">{$_(LEGAL_LINKS[key].labelKey)}</a>
  {/each}
</p>

<style>
  .legal-footer {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-size: 12px;
    color: var(--ink-faint, #9a9a9e);
  }
  .legal-footer a {
    color: inherit;
    text-decoration: underline;
  }
  .dot {
    color: var(--ink-faint, #9a9a9e);
  }
</style>
