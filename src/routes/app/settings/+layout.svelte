<script lang="ts">
  import type { OrgRole } from '$lib/org-roles';
  import { page } from '$app/stores';
  import { _ } from 'svelte-i18n';
  import PageTitle from '$lib/components/PageTitle.svelte';
  import PageHead from '$lib/components/PageHead.svelte';
  import { Notice } from '$lib/components/ui/notice';
  import { DASHBOARD_SETTINGS_GROUPS, dashboardSettingsHref, sectionEditable, SETTINGS_SECTIONS } from '$lib/components/settings/platforms';
  import '$lib/styles/settings-shell.css';

  let { data, children } = $props();

  const path = $derived($page.url.pathname.replace(/\/$/, ''));
  const editable = $derived(sectionEditable(path, data.org.role as OrgRole));
  const activeSection = $derived(SETTINGS_SECTIONS.find((s) => path.endsWith(`/settings/${s.path}`))?.path ?? '');
  const titleKey = $derived(SETTINGS_SECTIONS.find((s) => s.path === activeSection)?.labelKey);
  const title = $derived($_(titleKey ?? 'app.nav.settings'));
</script>

<div class="settings-frame has-nav">
  <nav class="settings-nav" aria-label={$_('app.nav.settings')}>
    {#each DASHBOARD_SETTINGS_GROUPS as group (group.labelKey)}
      <p class="nav-group">{$_(group.labelKey)}</p>
      {#each group.items as item (item.section)}
        <a
          class="nav-item"
          class:is-active={activeSection === item.section}
          aria-current={activeSection === item.section ? 'page' : undefined}
          href={dashboardSettingsHref(item.section)}>{$_(item.labelKey)}</a
        >
      {/each}
    {/each}
  </nav>
  <div class="content settings-shell">
    <PageHead {title} subtitle={null} />
    <PageTitle text={title} />
    {#if !editable}<Notice>View only: ask an admin of this organisation for edit access.</Notice>{/if}
    <div class="settings" inert={!editable}>
      {@render children()}
    </div>
  </div>
</div>

<style>
  .content {
    width: 100%;
    max-width: var(--content-max);
    margin-inline: auto;
    padding: var(--content-pad-top) var(--content-pad-x) var(--content-pad-bottom);
  }

  .settings-frame.has-nav {
    display: grid;
    grid-template-columns: 200px minmax(0, 1fr);
    gap: 32px;
    align-items: start;
    max-width: calc(var(--content-max) + 232px);
    margin: 0 auto;
  }

  .settings-nav {
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
  }

  .nav-group {
    margin: 16px 0 4px;
    padding: 0 8px;
    font-size: var(--ui-type-section);
    font-weight: var(--ui-weight-semibold);
    letter-spacing: var(--ui-tracking-caps);
    text-transform: uppercase;
    color: var(--ui-text-tertiary);
  }

  .nav-group:first-child {
    margin-top: 0;
  }

  .nav-item {
    display: flex;
    align-items: center;
    height: var(--ui-row-lg);
    padding: 0 8px;
    border-radius: var(--ui-radius-sm);
    font-size: var(--ui-type-body);
    text-decoration: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: background var(--ui-dur-fast) var(--ui-ease);
    color: var(--ui-text-secondary, #6e6e73);
  }

  .nav-item:hover,
  .nav-item.is-active {
    color: var(--ui-text);
    background: var(--ui-wash);
  }

  .nav-item.is-active {
    font-weight: var(--ui-weight-medium);
    border-radius: var(--ui-radius-md);
  }

  .nav-item:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }

  @media (max-width: 720px) {
    .settings-frame.has-nav {
      display: block;
    }

    .settings-nav {
      position: static;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 4px;
      padding: 12px var(--content-pad-x) 0;
    }

    .nav-group {
      display: none;
    }
  }
</style>
