<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Folder from '@lucide/svelte/icons/folder';
  import Plus from '@lucide/svelte/icons/plus';
  import ThemeSwitch from '$lib/components/ThemeSwitch.svelte';
  import CreditAmount from '$lib/components/CreditAmount.svelte';
  import { tourDialog } from '$lib/onboarding/tour-dialog.svelte';
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

  let menuOpen = $state(false);
  let foot = $state<HTMLElement | null>(null);

  function escaped(e: KeyboardEvent) {
    if (e.key !== 'Escape' || !menuOpen) {
      return;
    }
    menuOpen = false;
    foot?.querySelector<HTMLElement>('[data-testid="account-toggle"]')?.focus();
  }

  function left(e: FocusEvent) {
    if (foot?.contains(e.relatedTarget as Node | null)) {
      return;
    }
    menuOpen = false;
  }

  const labelOf =(label: NavLabel) => ('key' in label ? $_(label.key) : label.text);

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
  {:else if item.kind === NavKind.Tour}
    <button type="button" class="row" onclick={() => (tourDialog.open = true)} data-testid="open-tour">
      <item.icon size={ICON} strokeWidth={STROKE} />
      <span class="label">{labelOf(item.label)}</span>
    </button>
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

  <div class="group" data-testid="app-sidebar-canvas">
    <span class="heading">Projects</span>
    {#each projects as project (project.id)}
      <a class="row" href="/p/{project.id}">
        <Folder size={ICON} strokeWidth={STROKE} />
        <span class="label">{project.name}</span>
      </a>
    {/each}
    <form method="POST" action="/app?/project">
      <button type="submit" class="row new-project" data-testid="app-sidebar-new-project">
        <Plus size={ICON} strokeWidth={STROKE} />
        <span class="label">New project</span>
      </button>
    </form>
  </div>

  <div class="foot" bind:this={foot} onfocusout={left}>
    <div class="menu" id="account-menu" data-testid="account-menu" hidden={!menuOpen}>
      {#each inSection(NavSection.Account) as item (item.id)}
        {@render entry(item)}
      {/each}
    </div>

    <button type="button" class="account" data-testid="account-toggle" aria-expanded={menuOpen} aria-controls="account-menu" onclick={() => (menuOpen = !menuOpen)}>
      <span class="avatar" aria-hidden="true">
        {#if profile.avatarUrl}<img src={profile.avatarUrl} alt="" />{:else}{initials}{/if}
      </span>
      <span class="who">
        <span class="name">{profile.name ?? profile.email}</span>
        <span class="email">{profile.email}</span>
      </span>
    </button>

    {#if workspaces.length > 1}
      <div class="workspace">
          <form method="POST" action="/app?/workspace">
            <label class="sr-only" for="workspace-select">Workspace</label>
            <select id="workspace-select" name="orgId" value={org.id} onchange={(e) => e.currentTarget.form?.requestSubmit()}>
              {#each workspaces as w (w.id)}
                <option value={w.id}>{w.name}</option>
              {/each}
            </select>
          </form>
      </div>
    {/if}
  </div>
</nav>

<svelte:window onkeydown={escaped} />


<style>
  .app-sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-6);
    height: 100%;
    padding: var(--ui-space-3) var(--ui-space-2);
    overflow-y: auto;
    font-size: var(--ui-type-body);
    color: var(--ui-text-secondary);
  }

  .wordmark {
    padding: var(--ui-space-2) var(--ui-space-2) 0;
    font-size: var(--ui-text-lg);
    font-weight: var(--ui-weight-semibold);
    letter-spacing: -0.02em;
    color: var(--ui-text);
    text-decoration: none;
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .heading {
    padding: 0 var(--ui-space-2) var(--ui-space-1);
    font-size: var(--ui-type-section);
    font-weight: var(--ui-weight-semibold);
    text-transform: uppercase;
    letter-spacing: var(--ui-tracking-caps);
    color: var(--ui-text-tertiary);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    width: 100%;
    min-height: var(--ui-row-lg);
    padding: 0 var(--ui-space-2);
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    transition: background var(--ui-dur-fast) var(--ui-ease), color var(--ui-dur-fast) var(--ui-ease);
  }

  .row :global(svg) {
    flex: none;
    color: var(--ui-icon-ink);
  }

  .new-project {
    color: var(--ui-text-tertiary);
  }

  .row:hover {
    background: var(--ui-wash);
    color: var(--ui-text);
  }

  .row:active {
    background: var(--ui-pressed);
  }

  .row[aria-current='page'] {
    background: var(--ui-wash);
    color: var(--ui-text);
    font-weight: var(--ui-weight-medium);
  }

  .row[aria-current='page'] :global(svg) {
    color: var(--ui-text);
  }

  .row:focus-visible,
  .account:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
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
    padding: 0 var(--ui-space-1);
    border-radius: var(--ui-radius-xs);
    font-family: var(--ui-mono);
    font-size: 9px;
    line-height: 14px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ui-accent-text);
    background: var(--ui-selected);
  }

  .meta {
    font-family: var(--ui-mono);
    font-size: var(--ui-type-caption);
    color: var(--ui-text-tertiary);
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
    font-size: var(--ui-type-label);
    color: var(--ui-text-tertiary);
    text-decoration: none;
  }

  .legal-links a:hover {
    color: var(--ui-text);
  }

  .foot {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    margin-top: auto;
  }

  .menu {
    position: absolute;
    bottom: calc(100% + var(--ui-space-1));
    left: 0;
    right: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: var(--ui-space-1);
    border-radius: var(--ui-radius-md);
    background: var(--ui-panel-raised);
    box-shadow: var(--ui-shadow-float);
    color: var(--ui-text);
    animation: menu-in var(--ui-dur) var(--ui-ease);
  }

  .menu .row {
    min-height: var(--ui-row);
  }

  .menu[hidden] {
    display: none;
  }

  @keyframes menu-in {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .menu {
      animation: none;
    }
  }

  @media (pointer: coarse) {
    .row,
    .menu .row {
      min-height: 44px;
    }
  }

  .account {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    width: 100%;
    min-height: 44px;
    padding: var(--ui-space-1) var(--ui-space-2);
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: background var(--ui-dur-fast) var(--ui-ease);
  }

  .account:hover,
  .account[aria-expanded='true'] {
    background: var(--ui-wash);
  }

  .email {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: var(--ui-type-caption);
    color: var(--ui-text-tertiary);
  }

  .workspace {
    padding: 0 var(--ui-space-2);
  }

  .workspace select {
    width: 100%;
    height: var(--ui-row);
    padding: 0 var(--ui-space-2);
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-type-label);
  }

  .avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 28px;
    height: 28px;
    border-radius: var(--ui-radius-full);
    overflow: hidden;
    background: var(--ui-input);
    color: var(--ui-text-secondary);
    font-size: var(--ui-type-caption);
    font-weight: var(--ui-weight-semibold);
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
    font-size: var(--ui-type-label);
    font-weight: var(--ui-weight-medium);
    color: var(--ui-text);
  }
</style>
