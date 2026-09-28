<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { MOBILE_TABS, mobileTabHref, type MobileTab, type TabOutcome } from '$lib/shell-nav';
  import LayoutGrid from '@lucide/svelte/icons/layout-grid';
  import MessageCircle from '@lucide/svelte/icons/message-circle';
  import CalendarDays from '@lucide/svelte/icons/calendar-days';
  import MoreHorizontal from '@lucide/svelte/icons/more-horizontal';
  import type { Component } from 'svelte';

  const ICONS: Record<MobileTab['icon'], Component<{ size?: number }>> = {
    'layout-grid': LayoutGrid,
    'message-circle': MessageCircle,
    'calendar-days': CalendarDays,
    'more-horizontal': MoreHorizontal
  };

  let {
    projectId,
    active,
    onselect
  }: {
    projectId: string;
    active: MobileTab['id'];
    onselect: (tab: MobileTab) => TabOutcome;
  } = $props();

  function onLinkClick(event: MouseEvent, tab: MobileTab) {
    if (onselect(tab) === 'handled') {
      event.preventDefault();
    }
  }
</script>

<nav class="tabs" aria-label={$_('app.shell.rail')}>
  {#each MOBILE_TABS as tab (tab.id)}
    {@const Icon = ICONS[tab.icon]}
    {@const href = mobileTabHref(projectId, tab)}
    {#if href}
      <a {href} class="tab" class:is-active={active === tab.id} aria-current={active === tab.id ? 'page' : undefined} onclick={(e) => onLinkClick(e, tab)}>
        <Icon size={19} />
        <span>{$_(tab.labelKey)}</span>
      </a>
    {:else}
      <button type="button" class="tab" class:is-active={active === tab.id} onclick={() => onselect(tab)}>
        <Icon size={19} />
        <span>{$_(tab.labelKey)}</span>
      </button>
    {/if}
  {/each}
</nav>

<style>
  .tabs {
    flex: 0 0 auto;
    display: flex;
    align-items: stretch;
    height: calc(var(--mobile-tabbar-h) + env(safe-area-inset-bottom, 0px));
    border-top: 1px solid var(--line, #ededef);
    background: var(--paper, #fff);
    padding: 0 env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
  }

  .tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    appearance: none;
    border: 0;
    background: transparent;
    min-height: var(--touch-target);
    padding: 6px 4px;
    font: inherit;
    text-decoration: none;
    color: var(--ink-soft, #6e6e73);
    cursor: pointer;
  }
  .tab span {
    font-size: 11px;
    font-weight: 600;
  }
  .tab.is-active {
    color: var(--accent-ink, var(--accent, #7c5cff));
  }
</style>
