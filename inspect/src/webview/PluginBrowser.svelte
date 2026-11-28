<script lang="ts">
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import Puzzle from '@lucide/svelte/icons/puzzle';
  import X from '@lucide/svelte/icons/x';
  import { filterCards, type Card } from './plugin-browser';
  import { LINKS } from '../settings';

  let { cards, problems, canInstall, onenable, onremove, oninstall, onlink, onclose }: { cards: Card[]; problems: string[]; canInstall: boolean; onenable: (id: string, enabled: boolean) => void; onremove: (id: string) => void; oninstall: (source: string) => void; onlink: (url: string) => void; onclose: () => void } = $props();

  let query = $state('');
  let source = $state('');
  let openId = $state<string | null>(null);

  const shown = $derived(filterCards(cards, query));
  const open = $derived(cards.find((card) => card.id === openId) ?? null);

  function install() {
    const text = source.trim();
    if (text) {
      oninstall(text);
      source = '';
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key !== 'Escape') {
      return;
    }

    e.stopPropagation();
    if (open) {
      openId = null;
      return;
    }
    onclose();
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="scrim" role="presentation" onclick={(e) => e.target === e.currentTarget && onclose()}>
<div class="browser" role="dialog" aria-modal="true" aria-label="Plugins" data-testid="plugin-browser">
  <header>
    {#if open}
      <button type="button" class="icon" aria-label="Back to plugins" data-testid="plugin-back" onclick={() => (openId = null)}><ArrowLeft size={15} /></button>
      <h2>{open.name}</h2>
    {:else}
      <h2>Plugins</h2>
      <input type="search" placeholder="Search plugins" aria-label="Search plugins" data-testid="plugin-search" bind:value={query} />
    {/if}
    <button type="button" class="icon close" aria-label="Close plugins" data-testid="plugin-close" onclick={onclose}><X size={15} /></button>
  </header>

  {#if open}
    <article class="detail" data-testid="plugin-detail" data-plugin={open.id}>
      <div class="meta">
        <span class="badge" data-testid="plugin-badge">{open.badge}</span>
        <span class="version">v{open.version}</span>
        {#each open.badges as badge (badge)}<span class="badge">{badge}</span>{/each}
      </div>
      {#if open.description}<p>{open.description}</p>{:else if open.summary}<p>{open.summary}</p>{/if}
      {#if open.credit}<p class="credit" data-testid="plugin-credit">{open.credit}</p>{/if}

      <div class="actions">
        <label class="toggle"><input type="checkbox" role="switch" checked={open.enabled} aria-label={`Enable ${open.name}`} data-testid="plugin-enable" onchange={(e) => onenable(open.id, e.currentTarget.checked)} /><span class="track"></span>{open.enabled ? 'Enabled' : 'Off'}</label>
        {#if open.removable}<button type="button" class="action" data-testid="plugin-remove" onclick={() => (onremove(open.id), (openId = null))}>Remove</button>{/if}
        <button type="button" class="action" data-testid="plugin-docs" onclick={() => onlink(LINKS.plugins)}>Docs</button>
      </div>

      <h3>Permissions</h3>
      {#if open.words.length}
        <ul>{#each open.words as word (word)}<li>{word}</li>{/each}</ul>
      {:else}
        <p class="hint">None.</p>
      {/if}
    </article>
  {:else}
    <div class="grid" data-testid="plugin-grid">
      {#each shown as card (card.id)}
        <div class="card" data-testid="plugin-card" data-plugin={card.id}>
          <button type="button" class="open" aria-label={`Open ${card.name}`} data-testid="plugin-open" onclick={() => (openId = card.id)}>
            <span class="head">
              <span class="glyph"><Puzzle size={16} /></span>
              <span class="name">{card.name}</span>
              <span class="badge" data-testid="plugin-badge">{card.badge}</span>
            </span>
            <span class="summary">{card.summary}</span>
            {#if card.credit}<span class="credit" data-testid="plugin-credit">{card.credit}</span>{/if}
          </button>
          <div class="foot">
            <label class="toggle"><input type="checkbox" role="switch" checked={card.enabled} aria-label={`Enable ${card.name}`} data-testid="plugin-enable" onchange={(e) => onenable(card.id, e.currentTarget.checked)} /><span class="track"></span>{card.enabled ? 'Enabled' : 'Off'}</label>
            {#if card.removable}<button type="button" class="action" data-testid="plugin-remove" onclick={() => onremove(card.id)}>Remove</button>{/if}
          </div>
        </div>
      {:else}
        <p class="hint">No plugin matches.</p>
      {/each}
    </div>

    {#each problems as problem (problem)}<p class="problem">{problem}</p>{/each}

    {#if canInstall}
      <form class="install" onsubmit={(e) => (e.preventDefault(), install())}>
        <input type="text" bind:value={source} placeholder="github:owner/repo@tag or npm name" aria-label="Plugin source" data-testid="plugin-source" />
        <button type="submit" class="action" data-testid="plugin-install">Install</button>
      </form>
    {:else}
      <p class="hint">Install from a terminal: npx feega plugin add github:owner/repo</p>
    {/if}
  {/if}
</div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: grid;
    place-items: center;
    padding: 32px 24px;
    background: rgb(0 0 0 / 0.45);
  }

  .browser {
    width: min(880px, 100%);
    max-height: 100%;
    border: 1px solid var(--ui-border, rgb(255 255 255 / 0.08));
    border-radius: var(--ui-radius-lg, 12px);
    box-shadow: 0 24px 64px rgb(0 0 0 / 0.4);
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3, 12px);
    padding: var(--ui-space-3, 12px) 24px 24px;
    overflow-y: auto;
    background: var(--ui-panel);
    color: var(--ui-text);
    font-size: var(--ui-text-sm);
  }

  header {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
  }

  h2 {
    margin: 0;
    font-size: var(--ui-text-lg, 15px);
    font-weight: 600;
  }

  h3 {
    margin: 8px 0 0;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
    font-weight: 500;
  }

  header input[type='search'] {
    flex: 1;
    min-width: 0;
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
  }

  .icon {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-2);
    cursor: pointer;
  }

  .icon:hover {
    background: var(--ui-input);
  }

  .close {
    margin-left: auto;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
    grid-auto-rows: 1fr;
    gap: var(--ui-space-3, 12px);
  }

  .card {
    display: flex;
    flex-direction: column;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-input);
  }

  .open {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--ui-space-2);
    align-items: stretch;
    padding: 12px 12px 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .head {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    min-width: 0;
    height: 32px;
  }

  .glyph {
    display: grid;
    flex: none;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: var(--ui-radius-md, 8px);
    background: var(--ui-panel);
    color: var(--ui-text-2);
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .summary {
    display: -webkit-box;
    overflow: hidden;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
    line-height: 1.4;
    min-height: 2.8em;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ui-space-2);
    height: 40px;
    padding: 0 12px;
  }

  .actions,
  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--ui-space-2);
  }

  .badge {
    flex: none;
    padding: 0 6px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-panel);
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }

  .version,
  .credit,
  .hint,
  .problem {
    margin: 0;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  .problem {
    color: var(--ui-text-2);
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .toggle input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .track {
    position: relative;
    flex: none;
    width: 30px;
    height: 18px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-line-strong);
    transition: background var(--ui-dur-fast);
  }

  .track::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-thumb);
    transition: transform var(--ui-dur-fast);
  }

  .toggle input:checked + .track {
    background: var(--ui-accent);
  }

  .toggle input:checked + .track::after {
    transform: translateX(12px);
  }

  .toggle input:focus-visible + .track {
    outline: 2px solid var(--ui-accent);
  }

  .action,
  .install button {
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-panel);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .detail {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    max-width: 720px;
  }

  .detail p {
    margin: 0;
    line-height: 1.5;
  }

  ul {
    margin: 0;
    padding-left: 16px;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }

  .install {
    display: flex;
    gap: var(--ui-space-2);
  }

  .install input {
    flex: 1;
    min-width: 0;
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-xs);
  }
</style>
