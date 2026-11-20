<script lang="ts">
  import { Popover } from 'bits-ui';
  import { IconSource, ToHost, type IconHit, type Pick } from '../messages';
  import { toHost } from './host';
  import { iconSearch, nextIconRequest, wantPreview } from './icon-search.svelte';
  import { maskOf, nextTile } from './icon-name';
  import { sourceText } from './page-bridge';

  const SEARCH_DELAY_MS = 200;
  const GRID_COLUMNS = 6;
  const FIRST = 0;
  const ICON_SIZE = 24;
  const ICON_STROKE = 2;
  const VISIBLE_MARGIN = '80px';

  let { pick }: { pick: Pick } = $props();

  let query = $state('');
  let code = $state('');
  let timer: ReturnType<typeof setTimeout> | undefined;
  let upload: HTMLInputElement;
  let grid: HTMLDivElement;
  let queryBox: HTMLInputElement;
  let chosen = $state<IconSource | null>(null);
  let hovered = $state('');

  const at = $derived(sourceText(pick.source));
  const library = $derived(iconSearch.hits.filter((h) => h.source === IconSource.Library));
  const remote = $derived(iconSearch.hits.filter((h) => h.source === IconSource.IconMcp));
  const group = $derived(chosen ?? (library.length || !iconSearch.library ? IconSource.Library : IconSource.IconMcp));
  const shown = $derived(group === IconSource.Library && iconSearch.library ? library : group === IconSource.IconMcp ? remote : library);
  const showsRemote = $derived(group === IconSource.IconMcp || !iconSearch.library);
  const svgOf = (hit: IconHit) => (hit.source === IconSource.IconMcp ? iconSearch.previews[hit.name] : hit.svg);
  const loading = (hit: IconHit) => hit.source === IconSource.IconMcp && !(hit.name in iconSearch.previews);

  function whenVisible(tile: HTMLElement, hit: IconHit) {
    if (hit.source !== IconSource.IconMcp) {
      return;
    }
    const watcher = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && wantPreview(hit.name), { root: tile.closest('.icon-results'), rootMargin: VISIBLE_MARGIN });
    watcher.observe(tile);
    return { destroy: () => watcher.disconnect() };
  }

  function search(text: string) {
    query = text;
    clearTimeout(timer);
    timer = setTimeout(() => toHost({ kind: ToHost.IconSearch, id: nextIconRequest(), query: text, at }), SEARCH_DELAY_MS);
  }

  function move(e: KeyboardEvent) {
    const tiles = [...grid.querySelectorAll<HTMLButtonElement>('.icon-tile')];
    const from = tiles.indexOf(document.activeElement as HTMLButtonElement);
    const to = nextTile(e.key, from, tiles.length, GRID_COLUMNS);
    if (to === from) {
      return;
    }
    e.preventDefault();
    (to < FIRST ? queryBox : tiles[to]).focus();
  }

  function enter(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown') {
      return;
    }
    e.preventDefault();
    grid.querySelector<HTMLButtonElement>('.icon-tile')?.focus();
  }

  const pickHit = (hit: IconHit) => (hit.source === IconSource.Library ? useLibrary(hit.name) : useRemote(hit.name));
  const useLibrary = (name: string) => toHost({ kind: ToHost.IconSwap, at, name });
  const useRemote = (name: string) => toHost({ kind: ToHost.IconGet, at, name, size: ICON_SIZE, stroke: ICON_STROKE, inner: pick.inner });
  const apply = () => toHost({ kind: ToHost.IconMarkup, at, markup: code, inner: pick.inner });

  async function uploaded(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (file) {
      toHost({ kind: ToHost.IconMarkup, at, markup: (await file.text()).trim(), inner: pick.inner });
    }
  }
</script>

<div class="actions" data-testid="icon-actions">
  <Popover.Root onOpenChange={(open) => open && search(query)}>
    <Popover.Trigger class="action" data-field="icon-replace">Replace icon…</Popover.Trigger>
    <Popover.Portal>
      <Popover.Content class="picker-popover icon-popover" side="left" sideOffset={8} collisionPadding={8}>
        <input bind:this={queryBox} type="search" class="icon-query" placeholder="Search icons" aria-label="Search icons" value={query} oninput={(e) => search(e.currentTarget.value)} onkeydown={enter} />
        {#if iconSearch.library}
          <div class="icon-tabs" role="tablist">
            <button type="button" role="tab" class="icon-tab" aria-selected={group === IconSource.Library} onclick={() => (chosen = IconSource.Library)}>{iconSearch.library} {library.length}</button>
            <button type="button" role="tab" class="icon-tab" aria-selected={group === IconSource.IconMcp} onclick={() => (chosen = IconSource.IconMcp)}>iconmcp.com {remote.length}</button>
          </div>
        {:else}
          <div class="group-label">iconmcp.com</div>
        {/if}
        <div class="icon-results" bind:this={grid} role="grid" tabindex="-1" onkeydown={move}>
          {#each shown as hit (hit.source + hit.name)}
            <button type="button" class="icon-tile" use:whenVisible={hit} title={hit.label ?? hit.name} onclick={() => pickHit(hit)} onmouseenter={() => (hovered = hit.label ?? hit.name)} onfocus={() => (hovered = hit.label ?? hit.name)}>
              {#if svgOf(hit)}
                <span class="icon-glyph" style:mask-image={maskOf(svgOf(hit)!)} style:-webkit-mask-image={maskOf(svgOf(hit)!)}></span>
              {:else if loading(hit)}
                <span class="icon-skeleton"></span>
              {:else}
                <span class="icon-fallback">{hit.name}</span>
              {/if}
            </button>
          {/each}
        </div>
        {#if !shown.length && showsRemote && iconSearch.error}
          <div class="icon-note">iconmcp.com: {iconSearch.error}</div>
        {:else if !shown.length}
          <div class="icon-note">{showsRemote ? 'No icons found on iconmcp.com' : `No icons found in ${iconSearch.library}`}</div>
        {:else}
          <div class="icon-note icon-name">{hovered || shown[FIRST].name}</div>
        {/if}
        <button type="button" class="action" onclick={() => upload.click()}>Upload .svg…</button>
        <input bind:this={upload} type="file" accept=".svg,image/svg+xml" hidden onchange={uploaded} />
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>

  <Popover.Root onOpenChange={(open) => open && (code = pick.markup ?? '')}>
    <Popover.Trigger class="action" data-field="icon-edit-svg">Edit SVG</Popover.Trigger>
    <Popover.Portal>
      <Popover.Content class="picker-popover icon-popover" side="left" sideOffset={8} collisionPadding={8}>
        <textarea class="icon-code" aria-label="SVG markup" spellcheck="false" bind:value={code}></textarea>
        <button type="button" class="action" onclick={apply}>Apply</button>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
</div>

<style>
  .actions {
    display: flex;
    gap: 4px;
    padding: 4px 8px 0;
  }

  .actions :global(.action),
  :global(.icon-popover) :global(.action) {
    flex: 1;
    height: 24px;
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  :global(.icon-popover) {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 300px;
    padding: 8px;
  }

  :global(.icon-popover) .icon-query,
  :global(.icon-popover) .icon-code {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: inherit;
    font: inherit;
  }

  :global(.icon-popover) .icon-code {
    min-height: 160px;
    font-family: var(--ui-mono, monospace);
    resize: vertical;
  }

  :global(.icon-popover) .icon-results {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 2px;
    max-height: 264px;
    overflow-y: auto;
  }

  :global(.icon-popover) .icon-tabs {
    display: flex;
    gap: 2px;
  }

  :global(.icon-popover) .icon-tab {
    flex: 1;
    height: 24px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: inherit;
    font: inherit;
    opacity: 0.6;
    cursor: pointer;
  }

  :global(.icon-popover) .icon-tab[aria-selected='true'] {
    background: var(--ui-hover, rgb(128 128 128 / 0.15));
    opacity: 1;
  }

  :global(.icon-popover) .icon-tile {
    display: grid;
    place-items: center;
    height: 40px;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    content-visibility: auto;
    contain-intrinsic-size: 40px;
  }

  :global(.icon-popover) .icon-tile:hover,
  :global(.icon-popover) .icon-tile:focus-visible {
    background: var(--ui-hover, rgb(128 128 128 / 0.15));
    outline: 1px solid var(--ui-accent, currentColor);
  }

  :global(.icon-popover) .icon-glyph {
    width: 20px;
    height: 20px;
    background: currentColor;
    mask-size: contain;
    mask-repeat: no-repeat;
    mask-position: center;
    -webkit-mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-position: center;
  }

  :global(.icon-popover) .icon-skeleton {
    width: 20px;
    height: 20px;
    border-radius: var(--ui-radius-sm);
    background: currentColor;
    opacity: 0.08;
    animation: icon-pulse 1.2s ease-in-out infinite alternate;
  }

  @keyframes icon-pulse {
    to {
      opacity: 0.2;
    }
  }

  :global(.icon-popover) .icon-fallback {
    max-width: 100%;
    overflow: hidden;
    font-size: 9px;
    text-overflow: ellipsis;
    opacity: 0.6;
  }

  :global(.icon-popover) .icon-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.icon-popover) .group-label,
  :global(.icon-popover) .icon-note {
    padding: 4px 6px;
    opacity: 0.6;
  }
</style>
