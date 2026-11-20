<script lang="ts">
  import type { OrgRole } from '$lib/org-roles';
  import { page } from '$app/stores';
  import { _ } from 'svelte-i18n';
  import PageTitle from '$lib/components/PageTitle.svelte';
  import PageHead from '$lib/components/PageHead.svelte';
  import { Notice } from '$lib/components/ui/notice';
  import { sectionEditable, SETTINGS_SECTIONS } from '$lib/components/settings/platforms';
  import '$lib/styles/settings-shell.css';

  let { data, children } = $props();

  const path = $derived($page.url.pathname.replace(/\/$/, ''));
  const editable = $derived(sectionEditable(path, data.org.role as OrgRole));
  const activeSection = $derived(SETTINGS_SECTIONS.find((s) => path.endsWith(`/settings/${s.path}`))?.path ?? '');
  const titleKey = $derived(SETTINGS_SECTIONS.find((s) => s.path === activeSection)?.labelKey);
  const title = $derived($_(titleKey ?? 'app.nav.settings'));
</script>

<div class="settings-frame">
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

</style>
