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
  <nav class="rail" aria-label={$_('app.shell.rail')}>
    <div class="rail-group">
      {#each visibleNav(page.data.socialPublishing, navEntriesByGroup('panel')) as entry (entry.id)}
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
    position: absolute;
    z-index: 20;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px 5px;
    background: var(--paper, #fff);
    border: 1px solid var(--line, #ededef);
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
  }

  .rail-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .rail-divider {
    width: 20px;
    height: 1px;
    background: var(--line, #ededef);
    margin: 2px 0;
  }

  .rail-btn {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    appearance: none;
    border: 0;
    background: transparent;
    color: var(--ink-soft, #6e6e73);
    cursor: pointer;
  }
  .rail-btn:hover {
    background: var(--paper-2, #f9f9f9);
    color: var(--ink, #1d1d1f);
  }
  .rail-btn.is-active {
    background: var(--nav-on, color-mix(in srgb, var(--accent) 12%, transparent));
    color: var(--accent-ink, var(--accent, #7c5cff));
  }
</style>
