<script lang="ts">
  import { PROMPT_SOURCES, sourceTrigger, type PromptSource } from './handoff';
  import Icon, { type IconName } from './Icon.svelte';

  let { source = $bindable(), icons }: { source: PromptSource | null; icons: Record<PromptSource, IconName> } = $props();

  let open = $state(false);
  let menu = $state<HTMLDivElement | null>(null);
  let trigger = $state<HTMLButtonElement | null>(null);

  function items(): HTMLButtonElement[] {
    return [...(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
  }

  async function show() {
    open = true;
    await Promise.resolve();
    items()[0]?.focus();
  }

  function close() {
    open = false;
    trigger?.focus();
  }

  function pick(next: PromptSource | null) {
    source = next;
    close();
  }

  function keyed(e: KeyboardEvent) {
    const all = items();
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    const moves: Record<string, number> = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: all.length - 1 };

    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      close();
      return;
    }
    if (!(e.key in moves)) {
      return;
    }
    e.preventDefault();
    all[(moves[e.key] + all.length) % all.length]?.focus();
  }

  function outside(e: FocusEvent) {
    if (!open || menu?.parentElement?.contains(e.relatedTarget as Node)) {
      return;
    }
    open = false;
  }
</script>

<div class="picker" onfocusout={outside}>
  <button bind:this={trigger} type="button" class="trigger" class:on={source !== null} aria-haspopup="menu" aria-expanded={open} onclick={() => (open ? close() : show())}>
    {#if source}<Icon name={icons[source]} size={14} />{/if}
    <span>{sourceTrigger(source)}</span>
    <Icon name="chevron" size={14} />
  </button>

  {#if open}
    <div bind:this={menu} class="menu" role="menu" aria-label="Start from" tabindex="-1" onkeydown={keyed}>
      {#each PROMPT_SOURCES as row (row.source)}
        <button type="button" role="menuitem" aria-current={source === row.source} onclick={() => pick(row.source)}>
          <Icon name={icons[row.source]} size={14} />
          <span>{row.label}</span>
        </button>
      {/each}
      {#if source}
        <button type="button" role="menuitem" class="clear" onclick={() => pick(null)}>
          <Icon name="clear" size={14} />
          <span>Clear</span>
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .picker {
    position: relative;
    min-width: 0;
  }

  button {
    display: flex;
    align-items: center;
    gap: 6px;
    border: 0;
    font: inherit;
    font-size: 13px;
    white-space: nowrap;
    cursor: pointer;
  }

  .trigger {
    height: 30px;
    padding: 0 8px;
    border-radius: 8px;
    background: transparent;
    color: rgba(255, 255, 255, 0.55);
  }

  .trigger.on {
    background: color-mix(in srgb, #ff5100 16%, transparent);
    color: #fff;
  }

  .trigger span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .menu {
    position: absolute;
    bottom: calc(100% + 6px);
    left: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    min-width: 190px;
    padding: 4px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    background: #222;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
  }

  .menu button {
    gap: 8px;
    height: 34px;
    padding: 0 10px;
    border-radius: 4px;
    background: transparent;
    color: rgba(255, 255, 255, 0.85);
    text-align: left;
  }

  .menu button:hover,
  .menu button:focus-visible {
    background: rgba(255, 255, 255, 0.08);
    outline: none;
  }

  .menu [aria-current='true'] {
    color: #fff;
    background: color-mix(in srgb, #ff5100 16%, transparent);
  }

  .menu .clear {
    margin-top: 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 0 0 4px 4px;
    color: rgba(255, 255, 255, 0.55);
  }
</style>
