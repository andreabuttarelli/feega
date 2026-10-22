<script lang="ts">
  import { tick } from 'svelte';
  import { Kbd } from '$lib/components/ui/shell';
  import { searchPalette, type PaletteEntry } from '$lib/canvas/command-palette';
  import type { Command } from '$lib/motion/shortcuts';

  const PALETTE_KEY = 'k';
  const SHOWN_MAX = 40;

  let { onrun }: { onrun: (command: Command) => void } = $props();

  let open = $state(false);
  let query = $state('');
  let active = $state(0);
  let input = $state<HTMLInputElement | null>(null);
  const found = $derived(searchPalette(query).slice(0, SHOWN_MAX));

  async function show() {
    open = true;
    query = '';
    active = 0;
    await tick();
    input?.focus();
  }

  async function run(entry: PaletteEntry) {
    open = false;
    await tick();
    onrun(entry.command);
  }

  function onWindowKey(e: KeyboardEvent) {
    const toggle = e.key.toLowerCase() === PALETTE_KEY && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey;
    if (!toggle) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (open) {
      open = false;
      return;
    }
    void show();
  }

  const MOVES: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

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
      void run(found[active]);
    }
  }
</script>

<svelte:window onkeydowncapture={onWindowKey} />

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="scrim" onclick={() => (open = false)}></div>
  <div class="palette" role="dialog" aria-label="Command palette" data-testid="command-palette">
    <input bind:this={input} bind:value={query} oninput={() => (active = 0)} onkeydown={onInputKey} placeholder="Search actions…" aria-label="Search actions" data-testid="command-palette-input" />
    <div class="list" role="listbox">
      {#each found as entry, i (entry.command)}
        <button type="button" role="option" aria-selected={i === active} class:active={i === active} onpointerenter={() => (active = i)} onclick={() => run(entry)}>
          <span class="name">{entry.name}</span>
          {#if entry.label}<Kbd shortcut={entry.label} class="text-ui-text-3" />{/if}
        </button>
      {:else}
        <p class="empty">No action matches</p>
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

  .palette {
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
    border-bottom: 1px solid var(--ui-line-strong);
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
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .empty {
    padding: 10px;
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-3);
  }
</style>
