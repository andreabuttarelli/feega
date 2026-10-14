<script lang="ts">
  import { _ } from 'svelte-i18n';
  import * as Tooltip from '$lib/components/ui/tooltip/index.js';
  import { cn } from '$lib/utils';
  import { navEntriesByGroup, visibleNav, type NavEntry, type NavFamily } from '$lib/shell-nav';
  import { prefetchEntry } from '$lib/canvas/chrome-loaders';
  import { NAV_ICONS } from './nav-icons';
  import { ProjectMode, sectionAllowed } from '$lib/project-mode';
  import { page } from '$app/state';

  /**
   * LA RAIL FLOTTANTE: due gruppi separati da un divisore, e il divisore stesso dice il
   * comportamento — sopra apre un pannello accanto alla tela (Assets/Brands), sotto un foglio al
   * posto della tela (Ads/Settings). Nessun `if` per voce: `shell-nav.ts` è l'unica tabella, qui
   * si legge e basta.
   */
  let {
    activePanel = null,
    activeSheet = null,
    onPanel,
    onSheet,
    onRoute,
    mode = ProjectMode.Standard
  }: {
    activePanel?: string | null;
    activeSheet?: string | null;
    onPanel: (entry: NavEntry) => void;
    onSheet: (entry: NavEntry) => void;
    onRoute: (entry: NavEntry) => void;
    mode?: ProjectMode;
  } = $props();

  const sheets = $derived(visibleNav(page.data.socialPublishing, navEntriesByGroup('workbench')).filter((entry) => sectionAllowed(mode, entry.id)));

  const OPEN: Record<NavFamily, (entry: NavEntry) => void> = {
    panel: (entry) => onPanel(entry),
    sheet: (entry) => onSheet(entry),
    route: (entry) => onRoute(entry)
  };

  const ACTIVE: Record<NavFamily, (entry: NavEntry) => boolean> = {
    panel: (entry) => activePanel === entry.id,
    sheet: (entry) => activeSheet === entry.id,
    route: () => false
  };

  function onClick(entry: NavEntry) {
    OPEN[entry.family](entry);
  }

  function isActive(entry: NavEntry): boolean {
    return ACTIVE[entry.family](entry);
  }
</script>

{#snippet railButton(entry: NavEntry)}
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        {@const Icon = NAV_ICONS[entry.icon]}
        <button
          {...props}
          type="button"
          class={cn('rail-btn', isActive(entry) && 'is-active')}
          aria-pressed={isActive(entry)}
          aria-label={$_(entry.labelKey)}
          onclick={() => onClick(entry)}
          onmouseenter={() => prefetchEntry(entry.id)}
          onfocusin={() => prefetchEntry(entry.id)}
        >
          <Icon size={17} />
        </button>
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Content side="right">{$_(entry.labelKey)}</Tooltip.Content>
  </Tooltip.Root>
{/snippet}

<Tooltip.Provider delayDuration={200}>
  <nav class="rail" data-dock="left-bar" aria-label={$_('app.shell.rail')}>
    <div class="rail-group">
      {#each [...navEntriesByGroup('canvas'), ...visibleNav(page.data.socialPublishing, navEntriesByGroup('panel'))] as entry (entry.id)}
        {@render railButton(entry)}
      {/each}
    </div>

    <div class="rail-divider" role="separator"></div>

    <div class="rail-group">
      {#each sheets as entry (entry.id)}
        {@render railButton(entry)}
      {/each}
    </div>
  </nav>
</Tooltip.Provider>

<style>
  .rail {
    flex: 0 0 auto;
    align-self: stretch;
    z-index: 20;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 8px 6px;
    background: var(--ui-surface);
  }

  .rail-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .rail-divider {
    width: 20px;
    height: 1px;
    background: var(--ui-divider-strong);
    margin: 2px 0;
  }

  .rail-btn {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    appearance: none;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-icon-ink);
    cursor: pointer;
    transition: background-color var(--ui-dur-fast) var(--ui-ease), color var(--ui-dur-fast) var(--ui-ease);
  }
  .rail-btn:hover {
    background: var(--ui-wash);
    color: var(--ui-text);
  }
  .rail-btn:active {
    background: var(--ui-pressed);
  }
  .rail-btn:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }
  .rail-btn.is-active {
    background: var(--ui-selected);
    color: var(--ui-accent-text);
  }
</style>
