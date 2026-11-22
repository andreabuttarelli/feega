<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import type { LibraryEntry } from '../messages';
  import { LIBRARY_DRAG_TYPE, LibraryTab, LibraryTheme, PAGE_HEIGHT_PX, PAGE_WIDTH_PX, TABS, framedPage, scaleFor, visible } from './library';

  type Props = { items: LibraryEntry[]; canInsert: boolean; oninsert: (id: string) => void; onclose: () => void };

  let { items, canInsert, oninsert, onclose }: Props = $props();

  const PRO_TIER = 'pro';
  const INCLUDED_IN_CLOUD = 'Included in Feega Cloud';

  let tab = $state(LibraryTab.Sections);
  let query = $state('');
  let theme = $state(LibraryTheme.Light);
  let cardWidth = $state(0);

  const shown = $derived(visible(items, tab, query));
  const scale = $derived(scaleFor(cardWidth));

  function drag(e: DragEvent, item: LibraryEntry) {
    e.dataTransfer?.setData(LIBRARY_DRAG_TYPE, item.id);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'copy';
    }
  }
</script>

<div class="library" data-testid="library">
  <header class="head">
    <span>Library</span>
    <button type="button" class="icon" aria-label="Close Library" title="Close" data-testid="library-close" onclick={onclose}><X size={13} /></button>
  </header>

  <div class="tools">
    <input type="search" placeholder="Search" aria-label="Search the library" data-testid="library-search" spellcheck="false" bind:value={query} />
    <div class="themes" role="group" aria-label="Preview theme">
      {#each Object.values(LibraryTheme) as value (value)}
        <button type="button" class:on={theme === value} aria-pressed={theme === value} data-theme-choice={value} onclick={() => (theme = value)}>{value}</button>
      {/each}
    </div>
  </div>

  <div class="tabs" role="tablist">
    {#each TABS as t (t.id)}
      <button type="button" role="tab" class:on={!query.trim() && tab === t.id} aria-selected={!query.trim() && tab === t.id} data-testid={`library-tab-${t.id}`} onclick={() => ((tab = t.id), (query = ''))}>{t.label}</button>
    {/each}
  </div>

  <ul class="grid">
    {#each shown as item (item.id)}
      {@const locked = item.tier === PRO_TIER}
      <li class="card" data-testid="library-item" data-id={item.id} data-locked={locked} draggable="true" ondragstart={(e) => drag(e, item)}>
        <div class="thumb" bind:clientWidth={cardWidth} style={`height:${PAGE_HEIGHT_PX * scale}px`}>
          <iframe title={item.name} sandbox="" loading="lazy" tabindex="-1" srcdoc={framedPage(item, theme)} style={`width:${PAGE_WIDTH_PX}px;height:${PAGE_HEIGHT_PX}px;transform:scale(${scale})`}></iframe>
        </div>
        <div class="meta">
          <span class="name" title={item.description}>{item.name}</span>
          {#if locked}
            <span class="lock" data-testid="library-locked">{INCLUDED_IN_CLOUD}</span>
          {/if}
          <button type="button" class="insert" data-testid="library-insert" disabled={!canInsert} title={canInsert ? 'Insert after the selection' : 'Select an element first'} onclick={() => oninsert(item.id)}>Insert</button>
        </div>
      </li>
    {:else}
      <li class="empty">Nothing matches</li>
    {/each}
  </ul>
</div>

<style>
  .library {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .head {
    display: flex;
    align-items: center;
    flex: none;
    box-sizing: border-box;
    height: var(--top-row);
    padding: 0 12px;
    border-bottom: 1px solid var(--ui-divider);
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
    font-weight: 600;
  }

  .icon {
    display: grid;
    place-items: center;
    width: var(--ui-hit);
    height: var(--ui-hit);
    margin-left: auto;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: inherit;
    cursor: pointer;
  }

  .icon:hover {
    background: var(--ui-input-hover);
  }

  .tools {
    display: flex;
    flex: none;
    gap: 6px;
    padding: 8px 12px 0;
  }

  input[type='search'] {
    flex: 1;
    min-width: 0;
    height: 24px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: inherit;
    font: inherit;
    font-size: var(--ui-text-sm);
    outline: none;
  }

  input[type='search']:focus {
    box-shadow: inset 0 0 0 1px var(--ui-accent);
  }

  .themes {
    display: flex;
    flex: none;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
  }

  .themes button,
  .tabs button {
    border: 0;
    background: none;
    color: var(--ui-text-2);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .themes button {
    padding: 0 8px;
    text-transform: capitalize;
    border-radius: var(--ui-radius-sm);
  }

  .themes button.on {
    background: var(--ui-input-hover);
    color: var(--ui-text);
  }

  .tabs {
    display: flex;
    flex: none;
    gap: 2px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--ui-divider);
  }

  .tabs button {
    padding: 4px 8px;
    border-radius: var(--ui-radius-sm);
  }

  .tabs button.on {
    background: var(--ui-input-hover);
    color: var(--ui-text);
  }

  .grid {
    display: grid;
    flex: 1;
    gap: 12px;
    min-height: 0;
    margin: 0;
    padding: 12px;
    overflow-y: auto;
    list-style: none;
    align-content: start;
  }

  .card {
    display: grid;
    gap: 6px;
    cursor: grab;
  }

  .thumb {
    position: relative;
    overflow: hidden;
    border-radius: var(--ui-radius-md);
    box-shadow: 0 0 0 1px var(--ui-divider);
  }

  iframe {
    position: absolute;
    top: 0;
    left: 0;
    border: 0;
    transform-origin: 0 0;
    pointer-events: none;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    font-size: var(--ui-text-sm);
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-transform: capitalize;
  }

  .insert {
    margin-left: auto;
    padding: 2px 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-text);
    color: var(--ui-panel);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .insert:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .lock {
    margin-left: auto;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  .empty {
    color: var(--ui-text-3);
    font-size: var(--ui-text-sm);
  }
</style>
