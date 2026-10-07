<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Folder from '@lucide/svelte/icons/folder';
  import ThemeSwitch from '$lib/components/ThemeSwitch.svelte';
  import CreditAmount from '$lib/components/CreditAmount.svelte';
  import { FOOTER_LEGAL_LINKS, LEGAL_LINKS, legalHref } from '$lib/legal-links';
  import { NavKind, NavLoad, NavMeta, NavSection, isNavActive, navHref, visibleNav, type NavItem, type NavLabel } from '$lib/app-nav';

  let {
    pathname,
    projectId,
    projects,
    profile,
    org,
    workspaces,
    creditBalance
  }: {
    pathname: string;
    projectId: string | null;
    projects: { id: string; name: string }[];
    profile: { name: string | null; email: string; avatarUrl: string | null };
    org: { id: string; name: string };
    workspaces: { id: string; name: string }[];
    creditBalance: number;
  } = $props();

  const ICON = 15;
  const STROKE = 1.7;

  const items = $derived(visibleNav(projectId));
  const inSection = (section: NavSection) => items.filter((item) => item.section === section);

  const labelOf = (label: NavLabel) => ('key' in label ? $_(label.key) : label.text);

  const initials = $derived(
    (profile.name ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || profile.email[0]?.toUpperCase() || '?'
  );
</script>

{#snippet link(item: NavItem)}
  {@const href = navHref(item, projectId)}
  {#if href}
    <a
      class="row"
      {href}
      aria-current={isNavActive(href, pathname) ? 'page' : undefined}
      data-sveltekit-reload={item.load === NavLoad.Document ? '' : undefined}
    >
      <item.icon size={ICON} strokeWidth={STROKE} />
      <span class="label">{labelOf(item.label)}</span>
      {#if item.badge}<span class="badge">{item.badge}</span>{/if}
      {#if item.meta === NavMeta.Credits}<span class="meta"><CreditAmount amount={creditBalance} /></span>{/if}
    </a>
  {/if}
{/snippet}

{#snippet entry(item: NavItem)}
  {#if item.kind === NavKind.Link}
    {@render link(item)}
  {:else if item.kind === NavKind.Legal}
    <details class="legal">
      <summary class="row">
        <item.icon size={ICON} strokeWidth={STROKE} />
        <span class="label">{labelOf(item.label)}</span>
      </summary>
      <div class="legal-links">
        {#each FOOTER_LEGAL_LINKS as key (key)}
          <a href={legalHref(key)} target="_blank" rel="noopener">{$_(LEGAL_LINKS[key].labelKey)}</a>
        {/each}
      </div>
    </details>
  {:else if item.kind === NavKind.Theme}
    <div class="row static">
      <item.icon size={ICON} strokeWidth={STROKE} />
      <span class="label">{labelOf(item.label)}</span>
      <ThemeSwitch />
    </div>
  {:else if item.kind === NavKind.Logout}
    <form method="POST" action="/auth/signout">
      <button type="submit" class="row">
        <item.icon size={ICON} strokeWidth={STROKE} />
        <span class="label">{labelOf(item.label)}</span>
      </button>
    </form>
  {/if}
{/snippet}

<nav class="app-sidebar" aria-label="App" data-testid="app-sidebar">
  <a class="wordmark" href="/app">feega</a>

  <div class="group">
    {#each inSection(NavSection.Main) as item (item.id)}
      {@render entry(item)}
    {/each}
  </div>

  {#if projects.length}
    <div class="group">
      <span class="heading">Projects</span>
      {#each projects as project (project.id)}
        <a class="row" href="/p/{project.id}">
          <Folder size={ICON} strokeWidth={STROKE} />
          <span class="label">{project.name}</span>
        </a>
      {/each}
    </div>
  {/if}

  <div class="group" data-testid="app-sidebar-tools">
    <span class="heading">Tools</span>
    {#each inSection(NavSection.Tools) as item (item.id)}
      {@render entry(item)}
    {/each}
  </div>

  <div class="foot">
    <div class="group">
      {#each inSection(NavSection.Account) as item (item.id)}
        {@render entry(item)}
      {/each}
    </div>

    <div class="account">
      <span class="avatar" aria-hidden="true">
        {#if profile.avatarUrl}<img src={profile.avatarUrl} alt="" />{:else}{initials}{/if}
      </span>
      <span class="who">
        <span class="name">{profile.name ?? profile.email}</span>
        {#if workspaces.length > 1}
          <form method="POST" action="/app?/workspace">
            <label class="sr-only" for="workspace-select">Workspace</label>
            <select id="workspace-select" name="orgId" value={org.id} onchange={(e) => e.currentTarget.form?.requestSubmit()}>
              {#each workspaces as w (w.id)}
                <option value={w.id}>{w.name}</option>
              {/each}
            </select>
          </form>
        {:else}
          <span class="org">{org.name}</span>
        {/if}
      </span>
      {#if !projectId}<span class="meta"><CreditAmount amount={creditBalance} /></span>{/if}
    </div>
  </div>
</nav>

<style>
  .app-sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-6);
    height: 100%;
    padding: var(--ui-space-4) var(--ui-space-3);
    overflow-y: auto;
    font-size: var(--ui-text-md);
    color: var(--ui-ink-2);
  }

  .wordmark {
    padding: var(--ui-space-1) var(--ui-space-2);
    font-size: var(--ui-text-lg);
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--ui-ink);
    text-decoration: none;
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .heading {
    padding: 0 var(--ui-space-2) var(--ui-space-1);
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ui-ink-3);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    width: 100%;
    min-height: 30px;
    padding: 0 var(--ui-space-2);
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    transition: background 120ms, color 120ms;
  }

  .row:hover {
    background: var(--ui-hover);
    color: var(--ui-ink);
  }

  .row[aria-current='page'] {
    background: var(--ui-hover);
    color: var(--ui-ink);
    font-weight: 500;
  }

  .row:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 1px var(--ui-accent);
  }

  .row.static {
    cursor: default;
  }

  .row.static:hover {
    background: transparent;
    color: inherit;
  }

  .label {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .badge {
    padding: 0 4px;
    font-family: var(--ui-mono);
    font-size: 9px;
    line-height: 14px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ui-accent);
    background: var(--ui-accent-wash);
  }

  .meta {
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-3);
  }

  .legal summary {
    list-style: none;
  }

  .legal summary::-webkit-details-marker {
    display: none;
  }

  .legal-links {
    display: flex;
    flex-direction: column;
    padding: var(--ui-space-1) 0 var(--ui-space-2) calc(var(--ui-space-2) + 15px + var(--ui-space-2));
  }

  .legal-links a {
    padding: 3px 0;
    font-size: var(--ui-text-sm);
    color: var(--ui-ink-3);
    text-decoration: none;
  }

  .legal-links a:hover {
    color: var(--ui-ink);
  }

  .foot {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-4);
    margin-top: auto;
  }

  .account {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    padding: 0 var(--ui-space-2);
  }

  .avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 26px;
    height: 26px;
    overflow: hidden;
    background: var(--ui-surface);
    color: var(--ui-ink-2);
    font-size: var(--ui-text-xs);
    font-weight: 600;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .who {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0;
    line-height: 1.3;
  }

  .name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: var(--ui-text-sm);
    font-weight: 500;
    color: var(--ui-ink);
  }

  .org,
  .who select {
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-3);
  }

  .who select {
    max-width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
  }
</style>
