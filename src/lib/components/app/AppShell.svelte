<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { Snippet } from 'svelte';
  import FeegaMark from '$lib/components/FeegaMark.svelte';
  import Wordmark from './Wordmark.svelte';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { signOutForm } from '$lib/auth/sign-out-form';
  import { DASHBOARD_SETTINGS_HOME } from '$lib/settings/paths';
  import { dashboardSettingsHref } from '$lib/components/settings/platforms';
  import { SettingsSection } from '$lib/settings/sections';
  import type { AppShell as Shell } from '$lib/server/dashboard/app-shell';

  let { profile, children }: { profile: Shell['profile']; children: Snippet } = $props();

  const label = $derived(profile.name?.trim() || profile.email);
</script>

<div class="app-shell safe-shell ui-app">
  <header class="app-bar" data-testid="app-bar">
    <a class="home" href="/app" aria-label="feega"><FeegaMark size={20} /><Wordmark /></a>

    <DropdownMenu.Root>
      <DropdownMenu.Trigger class="account" data-testid="account-menu">{label}</DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Label>
          <span class="who">{profile.name?.trim() ?? ''}</span>
          <span class="email">{profile.email}</span>
        </DropdownMenu.Label>
        <DropdownMenu.Separator />
        <DropdownMenu.Item><a class="entry" href={DASHBOARD_SETTINGS_HOME}>{$_('app.account.settings')}</a></DropdownMenu.Item>
        <DropdownMenu.Item><a class="entry" href={dashboardSettingsHref(SettingsSection.Billing)}>{$_('app.account.billing')}</a></DropdownMenu.Item>
        <DropdownMenu.Item>
          <form method="POST" action="/auth/signout" use:signOutForm>
            <button type="submit" class="entry">{$_('app.account.signOut')}</button>
          </form>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </header>

  <main class="app-main">
    {@render children()}
  </main>
</div>

<style>
  .app-shell {
    min-height: 100dvh;
    background: var(--paper);
    color: var(--ui-text);
  }

  .app-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--ui-bar-h);
    padding: 0 var(--ui-space-4);
  }

  .home {
    display: inline-flex;
    align-items: center;
    gap: var(--ui-space-2);
    color: var(--ui-text);
    text-decoration: none;
  }

  .app-bar :global(.account) {
    max-width: 50vw;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: var(--ui-space-1) var(--ui-space-2);
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text);
    font-size: var(--ui-type-body);
  }

  .app-bar :global(.account:hover) {
    background: var(--ui-wash);
  }

  .app-bar :global(.account:focus-visible) {
    outline: none;
    box-shadow: var(--ui-ring);
  }

  .who,
  .email {
    display: block;
  }

  .email {
    color: var(--ui-text-tertiary);
  }

  .entry {
    display: block;
    width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    text-decoration: none;
  }

  .app-main {
    padding: var(--ui-space-4);
  }
</style>
