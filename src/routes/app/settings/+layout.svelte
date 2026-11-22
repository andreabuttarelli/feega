<script lang="ts">
  import type { OrgRole } from '$lib/org-roles';
  import { page } from '$app/stores';
  import { _ } from 'svelte-i18n';
  import PageTitle from '$lib/components/PageTitle.svelte';
  import PageHead from '$lib/components/PageHead.svelte';
  import { Notice } from '$lib/components/ui/notice';
  import { sectionEditable, SETTINGS_NAV, SETTINGS_SECTIONS } from '$lib/components/settings/platforms';
  import '$lib/styles/settings-shell.css';

  let { data, children } = $props();

  const path = $derived($page.url.pathname.replace(/\/$/, ''));
  const editable = $derived(sectionEditable(path, data.org.role as OrgRole));
  const activeSection = $derived(SETTINGS_SECTIONS.find((s) => path.endsWith(`/settings/${s.path}`))?.path ?? '');
  const titleKey = $derived(SETTINGS_SECTIONS.find((s) => s.path === activeSection)?.labelKey);
  const subtitleKey = $derived(SETTINGS_SECTIONS.find((s) => s.path === activeSection)?.subtitleKey);
  const title = $derived($_(titleKey ?? 'app.nav.settings'));
</script>

<div class="settings-frame">
  <div class="content settings-shell">
    <PageHead {title} subtitle={null} />
    <PageTitle text={title} />
    {#if subtitleKey}<p class="subtitle">{$_(subtitleKey)}</p>{/if}
    <nav class="tabs" aria-label={$_('app.nav.settings')}>
      {#each SETTINGS_NAV as entry (entry.section)}
        <a href={entry.href} aria-current={entry.section === activeSection ? 'page' : undefined}>{$_(entry.labelKey)}</a>
      {/each}
    </nav>
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

  .subtitle {
    margin: var(--ui-space-2) 0 0;
    font-size: var(--ui-text-lg);
    color: var(--ui-text-secondary);
  }

  .tabs {
    display: flex;
    gap: var(--ui-space-2);
    margin: 20px 0 var(--ui-space-6) -16px;
    overflow-x: auto;
  }

  .tabs a {
    padding: 8px 16px;
    border-radius: 999px;
    font-size: var(--ui-text-lg);
    color: var(--ui-text-secondary);
    text-decoration: none;
    white-space: nowrap;
  }

  .tabs a:hover {
    background: color-mix(in srgb, var(--ui-text) 12%, transparent);
  }

  .tabs a[aria-current='page'] {
    background: color-mix(in srgb, var(--ui-text) 12%, transparent);
    color: var(--ui-text);
  }

</style>
