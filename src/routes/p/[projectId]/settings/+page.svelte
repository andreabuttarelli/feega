<script lang="ts">
  import { _ } from 'svelte-i18n';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import { settingsGroupsFor } from '$lib/components/settings/platforms';
  import LegalFooter from '$lib/components/LegalFooter.svelte';

  let { data } = $props();

  const settingsBase = $derived(`/p/${data.project.id}/settings`);
</script>

<nav class="sections" aria-label={$_('app.nav.settings')}>
  {#each settingsGroupsFor(data.socialPublishing) as group (group.labelKey)}
    <h2>{$_(group.labelKey)}</h2>
    <ul>
      {#each group.items as item (item.section)}
        <li>
          <a href="{settingsBase}/{item.section}">
            <span>{$_(item.labelKey)}</span>
            <ChevronRight size={16} />
          </a>
        </li>
      {/each}
    </ul>
  {/each}
</nav>

<div class="legal-wrap">
  <LegalFooter />
</div>

<style>
  .sections {
    display: flex;
    flex-direction: column;
    max-width: 560px;
  }
  h2 {
    margin: 16px 0 6px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-soft, #6e6e73);
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--line, #ededef);
    background: var(--paper, #fff);
  }
  li + li {
    border-top: 1px solid var(--line, #ededef);
  }
  a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: var(--touch-target);
    padding: 0 14px;
    font-size: 14px;
    font-weight: 500;
    text-decoration: none;
    color: var(--ink, #1d1d1f);
  }

  .legal-wrap {
    margin: 24px 0 0;
    max-width: 560px;
  }
</style>
