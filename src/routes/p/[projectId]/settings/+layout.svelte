<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { SETTINGS_SECTIONS, SETTINGS_GROUPS } from '$lib/components/settings/platforms';
  import PageHead from '$lib/components/PageHead.svelte';
  import BrandGate from '$lib/components/settings/BrandGate.svelte';
  import { _ } from 'svelte-i18n';
  import ChevronLeft from '@lucide/svelte/icons/chevron-left';
  import '$lib/styles/settings-shell.css';

  let { data, children } = $props();
  const settingsBase = $derived(`/p/${data.project.id}/settings`);
  const path = $derived($page.url.pathname);
  /** OAuth intermediate pages keep their own full-page UI. */
  const isOauthFlow = $derived(
    path.includes('/settings/facebook') ||
      path.includes('/settings/linkedin') ||
      path.includes('/settings/connect/')
  );

  const isIndex = $derived(path.replace(/\/$/, '') === settingsBase);
  const SETTINGS_ROUTE_PREFIX = '/p/[projectId]/settings';
  const isRoutePage = $derived($page.route.id?.startsWith(SETTINGS_ROUTE_PREFIX) ?? false);
  const activeSection = $derived(path.replace(/\/$/, '').slice(settingsBase.length + 1));

  const isBrandKit = $derived(
    ['brand', 'products'].some((s) => path.replace(/\/$/, '').endsWith(`/settings/${s}`))
  );

  type SettingsHead = { title: string; subtitle?: string };

  const head = $derived.by((): SettingsHead => {
    const p = path.replace(/\/$/, '');
    const base = `/p/${data.project.id}/settings`;
    const map: Record<string, SettingsHead> = {
      [`${base}/project`]: {
        title: $_('app.settings.project.title')
      },
      [`${base}/brand`]: {
        title: $_('app.studio.tabs.brand')
      },
      [`${base}/products`]: {
        title: $_('app.studio.tabs.productsTitle')
      },
      [`${base}/connected-accounts`]: {
        title: $_('app.settings.connectedAccounts')
      },
      [`${base}/api-keys`]: {
        title: $_('app.settings.apiKeys.title')
      },
      [`${base}/team`]: {
        title: $_('app.settings.team.title')
      },
      [`${base}/profile`]: {
        title: $_('app.settings.profile.title')
      },
      [`${base}/appearance`]: {
        title: $_('app.settings.appearance.title')
      },
      [`${base}/billing`]: {
        title: $_('app.settings.billing.title')
      },
      [`${base}/danger`]: {
        title: $_('app.settings.del.title')
      }
    };
    return map[p] ?? { title: $_('app.nav.settings') };
  });

  // Legacy `#section` bookmarks → path-based pages (hash can survive the root redirect).
  onMount(() => {
    if (isOauthFlow) return;
    const hash = $page.url.hash.replace(/^#/, '');
    if (!hash || !SETTINGS_SECTIONS.some((s) => s.path === hash)) return;
    const p = path.replace(/\/$/, '');
    if (p.endsWith(`/${hash}`)) return;
    goto(`${settingsBase}/${hash}${$page.url.search}`, { replaceState: true });
  });
</script>

{#if isOauthFlow}
  {@render children()}
{:else}
  <div class="settings-frame" class:has-nav={isRoutePage && !isIndex}>
  {#if isRoutePage && !isIndex}
    <nav class="settings-nav" aria-label={$_('app.nav.settings')}>
      {#each SETTINGS_GROUPS as group (group.labelKey)}
        <p class="nav-group">{$_(group.labelKey)}</p>
        {#each group.items as item (item.section)}
          <a
            class="nav-item"
            class:is-active={activeSection === item.section}
            aria-current={activeSection === item.section ? 'page' : undefined}
            href="{settingsBase}/{item.section}">{$_(item.labelKey)}</a
          >
        {/each}
      {/each}
    </nav>
  {/if}
  <div class="content settings-shell" class:brand-kit={isBrandKit}>
    <PageHead title={head.title} subtitle={head.subtitle ?? null} />
    {#if !isIndex}
      <a class="back-to-sections" href={settingsBase}>
        <ChevronLeft size={16} />
        <span>{$_('app.nav.settings')}</span>
      </a>
    {/if}
    <div class="settings">
      {#if data.brandGate}
        <BrandGate projectId={data.project.id} returnTo={path} orgBrands={data.orgBrands} />
      {:else}
        {@render children()}
      {/if}
    </div>
  </div>
  </div>
{/if}

<style>
  .page-section {
    margin: 0 0 4px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-soft, #6e6e73);
  }
  .page-sub {
    margin: 6px 0 0;
    max-width: 42rem;
  }

  form { margin: 0; }

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
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-faint, #9a9a9e);
  }

  .nav-group:first-child {
    margin-top: 0;
  }

  .nav-item {
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 8px;
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    color: var(--ink-soft, #6e6e73);
  }

  .nav-item:hover {
    color: var(--ink);
    background: var(--paper-3);
  }

  .nav-item.is-active {
    color: var(--ink);
    background: var(--paper-3);
    font-weight: 600;
  }

  .nav-item:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  :global([data-viewport='mobile']) .settings-frame.has-nav {
    display: block;
  }

  :global([data-viewport='mobile']) .settings-nav {
    display: none;
  }

  .back-to-sections {
    display: none;
    align-items: center;
    gap: 4px;
    min-height: var(--touch-target);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    color: var(--ink-soft, #6e6e73);
  }
  :global([data-viewport='mobile']) .back-to-sections {
    display: inline-flex;
  }
</style>
