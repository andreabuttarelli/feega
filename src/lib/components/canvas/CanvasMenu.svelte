<script lang="ts">
  import { _ } from 'svelte-i18n';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
  import Menu from '@lucide/svelte/icons/menu';
  import House from '@lucide/svelte/icons/house';
  import Keyboard from '@lucide/svelte/icons/keyboard';
  import Settings from '@lucide/svelte/icons/settings';
  import CreditCard from '@lucide/svelte/icons/credit-card';
  import Sparkles from '@lucide/svelte/icons/sparkles';
  import LogOut from '@lucide/svelte/icons/log-out';
  import CreditAmount from '$lib/components/CreditAmount.svelte';
  import { CANVAS_SHORTCUTS } from '$lib/canvas/shortcuts';
  import { openSheet } from '$lib/canvas/sheet-nav';
  import { BURGER_ENTRIES, mobileNavHref } from '$lib/shell-nav';
  import { NAV_ICONS } from './nav-icons';
  import Scale from '@lucide/svelte/icons/scale';
  import Flag from '@lucide/svelte/icons/flag';
  import { REPORT_PATH } from '$lib/reports/report-link';
  import { FOOTER_LEGAL_LINKS, LEGAL_LINKS, legalHref } from '$lib/legal-links';

  type RailPages = 'include' | 'omit';

  let {
    projectId,
    profile,
    org,
    creditBalance,
    navigation = 'sheet',
    railPages = 'omit'
  }: {
    projectId: string;
    profile: { name: string | null; email: string; avatarUrl: string | null };
    org: { name: string } | null;
    creditBalance: number;
    navigation?: 'sheet' | 'page';
    railPages?: RailPages;
  } = $props();

  const isMac =
    typeof navigator !== 'undefined' &&
    /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

  const keyLabel = (k: string) => (k === 'mod' ? (isMac ? '⌘' : 'Ctrl') : k);

  const initials = $derived(
    (profile.name ?? '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || profile.email[0]?.toUpperCase() || '?'
  );

  type MenuGroup = 'navigate' | 'help' | 'account';
  type MenuAction = 'home' | 'settings' | 'billing' | 'shortcuts' | 'changelog' | 'report' | 'legal' | 'logout';

  /**
   * UNA VOCE, UNA RIGA: aggiungere una voce al menu è aggiungere una riga qui, non un altro `if`
   * nel markup. `href` è per la navigazione piena, `sheet` per aprire una sezione come foglio
   * sopra la tela, `sub` per il sottomenu delle scorciatoie. `group` decide sotto quale intestazione
   * la voce cade — è la sola cosa che il markup legge per raggruppare, così una voce nuova entra
   * con una riga, mai un `if` in più.
   */
  const CANVAS_MENU_ITEMS: ReadonlyArray<{
    id: MenuAction;
    group: MenuGroup;
    labelKey: string;
    icon: typeof House;
    href?: string;
    sheet?: string;
    sub?: true;
    danger?: true;
    marketingPage?: true;
    desktopOnly?: true;
  }> = [
    { id: 'home', group: 'navigate', labelKey: 'app.shell.menu.home', icon: House, href: `/p/${projectId}` },
    { id: 'settings', group: 'navigate', labelKey: 'app.shell.menu.settings', icon: Settings, sheet: '/settings/connected-accounts' },
    { id: 'billing', group: 'navigate', labelKey: 'app.shell.menu.billing', icon: CreditCard, sheet: '/settings/billing' },
    { id: 'shortcuts', group: 'help', labelKey: 'app.shell.menu.shortcuts', icon: Keyboard, sub: true, desktopOnly: true },
    { id: 'changelog', group: 'help', labelKey: 'app.shell.menu.changelog', icon: Sparkles, href: '/changelog', marketingPage: true },
    { id: 'report', group: 'help', labelKey: 'app.shell.menu.report', icon: Flag, href: REPORT_PATH },
    { id: 'legal', group: 'help', labelKey: 'legal.menuLabel', icon: Scale, sub: true },
    { id: 'logout', group: 'account', labelKey: 'app.shell.menu.logout', icon: LogOut, danger: true }
  ];

  const ITEMS_THE_RAIL_ALREADY_HAS: ReadonlySet<MenuAction> = new Set(['settings']);

  const navigateItems = CANVAS_MENU_ITEMS.filter(
    (item) => item.group === 'navigate' && !(railPages === 'include' && ITEMS_THE_RAIL_ALREADY_HAS.has(item.id))
  );
  const helpItems = CANVAS_MENU_ITEMS.filter(
    (item) => item.group === 'help' && !(navigation === 'page' && item.desktopOnly)
  );

  function hrefOf(item: (typeof CANVAS_MENU_ITEMS)[number]): string | undefined {
    if (item.sheet && navigation === 'page') {
      return `/p/${projectId}${item.sheet}`;
    }
    return item.href;
  }

  function onItemClick(item: (typeof CANVAS_MENU_ITEMS)[number]) {
    if (item.sheet) {
      openSheet(projectId, item.sheet).catch((err) => {
        console.error(`apertura del foglio "${item.id}" fallita`, err);
      });
    }
  }
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger class="burger-btn" aria-label={$_('app.shell.menu.open')} title={$_('app.shell.menu.open')}>
    <Menu size={16} strokeWidth={1.8} />
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="start" sideOffset={8} class="canvas-menu" style="--bits-dropdown-menu-anchor-width: 260px;">
    <div class="menu-header">
      <span class="menu-avatar" aria-hidden="true">
        {#if profile.avatarUrl}
          <img src={profile.avatarUrl} alt="" />
        {:else}
          {initials}
        {/if}
      </span>
      <span class="menu-identity">
        <span class="menu-name">{profile.name ?? profile.email}</span>
        <span class="menu-email">{profile.email}</span>
        {#if org}
          <span class="menu-org">{org.name}</span>
        {/if}
      </span>
    </div>

    <DropdownMenu.Separator />

    <DropdownMenu.Group>
      <DropdownMenu.GroupHeading class="menu-heading">{$_('app.shell.menu.navigate')}</DropdownMenu.GroupHeading>
      {#each navigateItems as item (item.id)}
        <DropdownMenu.Item class="menu-row">
          {#snippet child({ props })}
            {#if hrefOf(item)}
              <a {...props} href={hrefOf(item)}>
                <item.icon size={16} />
                <span>{$_(item.labelKey)}</span>
              </a>
            {:else}
              <button {...props} type="button" onclick={() => onItemClick(item)}>
                <item.icon size={16} />
                <span>{$_(item.labelKey)}</span>
                {#if item.id === 'billing'}
                  <span class="menu-balance"><CreditAmount amount={creditBalance} /></span>
                {/if}
              </button>
            {/if}
          {/snippet}
        </DropdownMenu.Item>
      {/each}
    </DropdownMenu.Group>

    {#if railPages === 'include'}
      <DropdownMenu.Separator />

      <DropdownMenu.Group>
        <DropdownMenu.GroupHeading class="menu-heading">{$_('app.shell.menu.pages')}</DropdownMenu.GroupHeading>
        {#each BURGER_ENTRIES as entry (entry.id)}
          {@const Icon = NAV_ICONS[entry.icon]}
          <DropdownMenu.Item class="menu-row">
            {#snippet child({ props })}
              <a {...props} href={mobileNavHref(projectId, entry)}>
                <Icon size={16} />
                <span>{$_(entry.labelKey)}</span>
              </a>
            {/snippet}
          </DropdownMenu.Item>
        {/each}
      </DropdownMenu.Group>
    {/if}

    <DropdownMenu.Separator />

    <DropdownMenu.Group>
      <DropdownMenu.GroupHeading class="menu-heading">{$_('app.shell.menu.help')}</DropdownMenu.GroupHeading>
      {#each helpItems as item (item.id)}
        {#if item.id === 'legal'}
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger class="menu-row sub-trigger">
              <item.icon size={16} />
              <span>{$_(item.labelKey)}</span>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent class="legal-content">
              {#each FOOTER_LEGAL_LINKS as key (key)}
                <a class="legal-row" href={legalHref(key)} target="_blank" rel="noopener">
                  {$_(LEGAL_LINKS[key].labelKey)}
                </a>
              {/each}
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
        {:else if item.sub}
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger class="menu-row sub-trigger">
              <item.icon size={16} />
              <span>{$_(item.labelKey)}</span>
            </DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent class="shortcuts-content">
              <ul class="keys">
                {#each CANVAS_SHORTCUTS as row, i (row.id + i)}
                  <li>
                    <span class="keys-label">{row.label}</span>
                    <span class="combo">
                      {#each row.keys as k (k)}<kbd>{keyLabel(k)}</kbd>{/each}
                    </span>
                  </li>
                {/each}
              </ul>
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
        {:else}
          <DropdownMenu.Item class="menu-row">
            {#snippet child({ props })}
              <a {...props} href={item.href} data-sveltekit-reload={item.marketingPage ? '' : undefined}>
                <item.icon size={16} />
                <span>{$_(item.labelKey)}</span>
              </a>
            {/snippet}
          </DropdownMenu.Item>
        {/if}
      {/each}
    </DropdownMenu.Group>

    <DropdownMenu.Separator />

    <DropdownMenu.Group>
      <DropdownMenu.GroupHeading class="menu-heading">{$_('app.shell.menu.account')}</DropdownMenu.GroupHeading>
      <DropdownMenu.Item class="menu-row is-danger" variant="destructive">
        {#snippet child({ props })}
          <form {...props} method="POST" action="/auth/signout">
            <button type="submit" class="menu-logout">
              <LogOut size={16} />
              <span>{$_('app.shell.menu.logout')}</span>
            </button>
          </form>
        {/snippet}
      </DropdownMenu.Item>
    </DropdownMenu.Group>
  </DropdownMenu.Content>
</DropdownMenu.Root>

<style>
  :global(.burger-btn) {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--ink-soft, #6e6e73);
    cursor: pointer;
  }
  :global(.burger-btn:hover) {
    background: var(--paper-2, #f9f9f9);
    color: var(--ink, #1d1d1f);
  }

  :global([data-slot='dropdown-menu-content'].canvas-menu) {
    width: 260px !important;
    padding: 6px;
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    box-shadow: 0 4px 18px rgb(0 0 0 / 0.1);
  }

  .menu-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 6px 10px;
  }

  .menu-avatar {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 32px;
    height: 32px;
    overflow: hidden;
    background: var(--paper-3, #f4f4f4);
    color: var(--ink-soft, #6e6e73);
    font-size: 12px;
    font-weight: 600;
  }
  .menu-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .menu-header {
    min-width: 0;
  }
  .menu-identity {
    display: flex;
    min-width: 0;
    flex: 1 1 auto;
    flex-direction: column;
  }
  .menu-name {
    display: block;
    width: 100%;
    overflow: hidden;
    color: var(--ink, #1d1d1f);
    font-size: 13px;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .menu-email,
  .menu-org {
    display: block;
    width: 100%;
    overflow: hidden;
    color: var(--ink-faint, #86868b);
    font-size: 11.5px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.menu-heading) {
    padding: 6px 6px 4px;
    color: var(--ink-faint, #86868b);
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  :global([data-slot='dropdown-menu-item'].menu-row),
  :global([data-slot='dropdown-menu-sub-trigger'].menu-row) {
    display: flex !important;
    width: 100% !important;
    padding: 0 !important;
    align-items: stretch !important;
  }
  :global(.menu-row a),
  :global(.menu-row button) {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 36px;
    padding: 0 8px;
    appearance: none;
    border: 0;
    background: transparent;
    font: inherit;
    font-size: 13px;
    color: inherit;
    text-decoration: none;
    cursor: pointer;
    box-sizing: border-box;
  }
  :global(.menu-row a),
  :global(.menu-row button) {
    min-width: 0;
  }
  :global(.menu-row a span:not(.menu-balance)),
  :global(.menu-row button span:not(.menu-balance)) {
    overflow: hidden;
    min-width: 0;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  :global([data-slot='dropdown-menu-sub-trigger'].menu-row) {
    gap: 8px;
    height: 36px;
    padding: 0 8px !important;
    box-sizing: border-box;
    font-size: 13px;
  }
  :global(.menu-row.sub-trigger span) {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .menu-balance {
    margin-left: auto;
    color: var(--ink-faint, #86868b);
    font-size: 12px;
  }

  :global(.menu-row.is-danger a),
  :global(.menu-row.is-danger button) {
    color: var(--ink-faint, #86868b);
  }
  :global(.menu-row.is-danger:hover a),
  :global(.menu-row.is-danger:hover button) {
    color: var(--sh-destructive, #c0392b);
  }

  .menu-logout {
    all: unset;
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 36px;
    padding: 0 8px;
    box-sizing: border-box;
    font-size: 13px;
    cursor: pointer;
  }
  .menu-logout span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  @media (max-width: 767px) {
    :global([data-slot='dropdown-menu-content'].canvas-menu) {
      max-height: calc(var(--bits-dropdown-menu-content-available-height) - var(--mobile-bar-inset));
      overflow-y: auto;
    }
    :global(a.menu-row),
    :global(button.menu-row),
    .menu-logout {
      min-height: var(--touch-target);
      font-size: 15px;
    }
    .menu-logout {
      padding: 0;
    }
    :global(.menu-heading) {
      padding: 12px 8px 4px;
      font-size: 12px;
    }
    .menu-name {
      font-size: 15px;
    }
    .menu-email,
    .menu-org {
      font-size: 13px;
    }
  }

  :global(.shortcuts-content) {
    width: 240px;
    max-height: 60vh;
    overflow-y: auto;
  }

  :global(.legal-content) {
    width: 220px;
    max-height: 60vh;
    padding: 4px;
    overflow-y: auto;
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    box-shadow: 0 4px 18px rgb(0 0 0 / 0.1);
  }
  .legal-row {
    display: flex;
    align-items: center;
    height: 34px;
    padding: 0 8px;
    font-size: 13px;
    color: var(--ink, #1d1d1f);
    text-decoration: none;
  }
  .legal-row:hover {
    background: var(--paper-2, #f9f9f9);
  }
  @media (max-width: 767px) {
    .legal-row {
      min-height: var(--touch-target);
      font-size: 15px;
    }
  }
  .keys {
    margin: 0;
    padding: 2px;
    list-style: none;
  }
  .keys li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 6px 8px;
  }
  .keys-label {
    font-size: 12.5px;
    color: var(--ink, #1d1d1f);
  }
  .combo {
    display: inline-flex;
    flex-shrink: 0;
    gap: 3px;
  }
  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border: 1px solid var(--line, #e5e5e5);
    background: var(--paper-2, #f9f9f9);
    font-family: inherit;
    font-size: 11px;
    color: var(--ink-soft, #6e6e73);
  }
</style>
