<script lang="ts">
  import { page } from '$app/stores';
  import { _ } from 'svelte-i18n';
  import { BRAND_SETTINGS_ITEMS, brandPageAt, brandSettingsHref } from '$lib/components/settings/platforms';

  let { data, children } = $props();

  const active = $derived(brandPageAt($page.url.pathname)?.section ?? '');
</script>

<nav class="brand-tabs" aria-label={data.brand.name}>
  <p class="brand-name">{data.brand.name}</p>
  <div class="tabs">
    {#each BRAND_SETTINGS_ITEMS as item (item.section)}
      <a class="tab" class:is-active={active === item.section} aria-current={active === item.section ? 'page' : undefined} href={brandSettingsHref(data.brand.id, item.section)}>{$_(item.labelKey)}</a>
    {/each}
  </div>
</nav>

{@render children()}

<style>
  .brand-tabs {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .brand-name {
    margin: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--ui-type-section);
    font-weight: var(--ui-weight-semibold);
    letter-spacing: var(--ui-tracking-caps);
    text-transform: uppercase;
    color: var(--ui-text-tertiary);
  }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .tab {
    display: flex;
    align-items: center;
    min-height: var(--touch-target);
    padding: 0 12px;
    border-radius: var(--ui-radius-sm);
    font-size: var(--ui-type-body);
    text-decoration: none;
    color: var(--ui-text-secondary);
  }

  .tab:hover,
  .tab.is-active {
    color: var(--ui-text);
    background: var(--ui-wash);
  }

  .tab.is-active {
    font-weight: var(--ui-weight-medium);
  }

  .tab:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }
</style>
