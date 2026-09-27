<script lang="ts">
  import { _ } from 'svelte-i18n';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
  import Menu from '@lucide/svelte/icons/menu';
  import House from '@lucide/svelte/icons/house';
  import Keyboard from '@lucide/svelte/icons/keyboard';
  import Settings from '@lucide/svelte/icons/settings';
  import CreditCard from '@lucide/svelte/icons/credit-card';
  import LogOut from '@lucide/svelte/icons/log-out';
  import { CANVAS_SHORTCUTS } from '$lib/canvas/shortcuts';
  import { openSheet } from '$lib/canvas/sheet-nav';

  let { projectId }: { projectId: string } = $props();

  const isMac =
    typeof navigator !== 'undefined' &&
    /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

  const keyLabel = (k: string) => (k === 'mod' ? (isMac ? '⌘' : 'Ctrl') : k);

  type MenuAction = 'home' | 'shortcuts' | 'settings' | 'billing' | 'logout';

  /**
   * UNA VOCE, UNA RIGA: aggiungere una voce al menu è aggiungere una riga qui, non un altro `if`
   * nel markup. `href` è per la navigazione piena (Home, Esci), `sheet` per aprire una sezione
   * come foglio sopra la tela senza smontarla (Impostazioni, Fatturazione).
   */
  const CANVAS_MENU_ITEMS: ReadonlyArray<{
    id: MenuAction;
    labelKey: string;
    icon: typeof House;
    href?: string;
    sheet?: string;
  }> = [
    { id: 'home', labelKey: 'app.shell.menu.home', icon: House, href: `/p/${projectId}` },
    { id: 'settings', labelKey: 'app.shell.menu.settings', icon: Settings, sheet: '/settings/connected-accounts' },
    { id: 'billing', labelKey: 'app.shell.menu.billing', icon: CreditCard, sheet: '/settings/billing' }
  ];

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
  <DropdownMenu.Content align="start" class="w-64">
    <DropdownMenu.Item>
      {#snippet child({ props })}
        <a {...props} href={`/p/${projectId}`} class="menu-row">
          <House size={15} />
          <span>{$_('app.shell.menu.home')}</span>
        </a>
      {/snippet}
    </DropdownMenu.Item>

    <DropdownMenu.Sub>
      <DropdownMenu.SubTrigger class="menu-row">
        <Keyboard size={15} />
        <span>{$_('app.shell.menu.shortcuts')}</span>
      </DropdownMenu.SubTrigger>
      <DropdownMenu.SubContent class="max-h-[60vh] w-72 overflow-y-auto">
        <ul class="keys">
          {#each CANVAS_SHORTCUTS as row, i (row.id + i)}
            <li>
              <span>{row.label}</span>
              <span class="combo">
                {#each row.keys as k (k)}<kbd>{keyLabel(k)}</kbd>{/each}
              </span>
            </li>
          {/each}
        </ul>
      </DropdownMenu.SubContent>
    </DropdownMenu.Sub>

    {#each CANVAS_MENU_ITEMS.filter((item) => item.id !== 'home') as item (item.id)}
      <DropdownMenu.Item class="menu-row" onclick={() => onItemClick(item)}>
        <item.icon size={15} />
        <span>{$_(item.labelKey)}</span>
      </DropdownMenu.Item>
    {/each}

    <DropdownMenu.Separator />

    <DropdownMenu.Item>
      {#snippet child({ props })}
        <form {...props} method="POST" action="/auth/signout" class="menu-row">
          <button type="submit" class="menu-logout">
            <LogOut size={15} />
            <span>{$_('app.shell.menu.logout')}</span>
          </button>
        </form>
      {/snippet}
    </DropdownMenu.Item>
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

  :global(.menu-row) {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-decoration: none;
    color: inherit;
  }

  .menu-logout {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    appearance: none;
    border: 0;
    background: transparent;
    padding: 0;
    font: inherit;
    color: inherit;
    cursor: pointer;
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
    padding: 5px 8px;
    font-size: 12.5px;
  }
  .combo {
    display: inline-flex;
    gap: 3px;
    flex-shrink: 0;
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
