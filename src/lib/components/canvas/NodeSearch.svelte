<script lang="ts">
  import { tick } from 'svelte';
  import { searchNodes, type SearchableNode } from '$lib/canvas/node-search';
  import { NODE_KIND_LABEL } from '$lib/canvas/node-label';
  import type { NodeType } from '$lib/canvas/node-data';
  import { COLOUR_TAGS, COLOUR_TAG_HEX, colourOf, type ColourTag } from '$lib/canvas/node-colour';

  const FIND_KEY = 'f';
  const SHOWN_MAX = 30;
  const MOVES: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

  let { nodes, onjump }: { nodes: readonly SearchableNode[]; onjump: (id: string) => void } = $props();

  let open = $state(false);
  let query = $state('');
  let active = $state(0);
  let colour = $state<ColourTag | null>(null);
  let input = $state<HTMLInputElement | null>(null);
  const found = $derived(searchNodes(nodes, query, colour).slice(0, SHOWN_MAX));

  function titleOf(node: SearchableNode): string {
    const own = node.displayName ?? (typeof node.data.title === 'string' ? node.data.title : null);
    return own ?? NODE_KIND_LABEL[node.type as NodeType] ?? node.type;
  }

  function snippetOf(node: SearchableNode): string {
    const text = node.data.prompt ?? node.data.text ?? '';
    return typeof text === 'string' ? text.slice(0, 80) : '';
  }

  async function show() {
    open = true;
    query = '';
    colour = null;
    active = 0;
    await tick();
    input?.focus();
  }

  function pickColour(tag: ColourTag) {
    colour = colour === tag ? null : tag;
    active = 0;
    input?.focus();
  }

  function jump(node: SearchableNode) {
    open = false;
    onjump(node.id);
  }

  function onWindowKey(e: KeyboardEvent) {
    const find = e.key.toLowerCase() === FIND_KEY && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey;
    if (!find) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    void show();
  }

  function onInputKey(e: KeyboardEvent) {
    e.stopPropagation();
    const move = MOVES[e.key];
    if (move) {
      e.preventDefault();
      active = (active + move + found.length) % Math.max(found.length, 1);
      return;
    }
    if (e.key === 'Escape') {
      open = false;
      return;
    }
    if (e.key === 'Enter' && found[active]) {
      e.preventDefault();
      jump(found[active]);
    }
  }
</script>

<svelte:window onkeydowncapture={onWindowKey} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="scrim" onclick={() => (open = false)}></div>
  <div class="find" role="dialog" aria-label="Find on canvas" data-testid="node-search">
    <input bind:this={input} bind:value={query} oninput={() => (active = 0)} onkeydown={onInputKey} placeholder="Find nodes by name, text or prompt…" aria-label="Find on canvas" data-testid="node-search-input" />
    <div class="chips" role="group" aria-label="Colour tag">
      {#each COLOUR_TAGS as tag (tag)}
        <button type="button" class="chip" class:on={colour === tag} aria-pressed={colour === tag} aria-label={`Filter ${tag}`} data-testid={`search-colour-${tag}`} style={`--tag:${COLOUR_TAG_HEX[tag]}`} onclick={() => pickColour(tag)}></button>
      {/each}
    </div>
    <div class="list" role="listbox">
      {#each found as node, i (node.id)}
        <button type="button" role="option" aria-selected={i === active} class:active={i === active} onpointerenter={() => (active = i)} onclick={() => jump(node)}>
          {#if colourOf(node.data)}<span class="dot" style={`--tag:${COLOUR_TAG_HEX[colourOf(node.data)!]}`}></span>{/if}
          <span class="name">{titleOf(node)}</span>
          <span class="snippet">{snippetOf(node)}</span>
        </button>
      {:else}
        {#if query.trim() || colour}<p class="empty">Nothing matches</p>{/if}
      {/each}
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 60;
  }

  .find {
    position: fixed;
    top: 15vh;
    left: 50%;
    z-index: 61;
    width: min(520px, calc(100vw - 32px));
    transform: translateX(-50%);
    border: 1px solid var(--ui-line-strong);
    border-radius: var(--ui-radius-lg);
    background: var(--ui-surface, var(--background));
    box-shadow: 0 12px 40px rgb(0 0 0 / 0.18);
    overflow: hidden;
  }

  input {
    width: 100%;
    height: 44px;
    padding: 0 14px;
    border: 0;
    background: transparent;
    color: var(--ui-ink);
    font: inherit;
    outline: none;
  }

  .list {
    max-height: 50vh;
    overflow-y: auto;
    padding: 4px;
  }

  .list:not(:empty) {
    border-top: 1px solid var(--ui-line-strong);
  }

  button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 32px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-ink);
    font: inherit;
    font-size: var(--ui-text-xs);
    text-align: left;
    cursor: pointer;
  }

  button.active {
    background: var(--ui-accent-wash);
  }

  .name {
    flex: none;
    max-width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .snippet {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--ui-ink-3);
  }

  .chips {
    display: flex;
    gap: 6px;
    padding: 0 14px 8px;
  }

  .chip {
    width: 16px;
    height: 16px;
    padding: 0;
    border: 2px solid transparent;
    border-radius: 9999px;
    background: var(--tag);
  }

  .chip.on {
    border-color: var(--ui-ink);
  }

  .dot {
    flex: none;
    width: 8px;
    height: 8px;
    border-radius: 9999px;
    background: var(--tag);
  }

  .empty {
    padding: 10px;
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-3);
  }
</style>
