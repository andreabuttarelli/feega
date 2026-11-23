<script lang="ts">
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import { tick } from 'svelte';
  import { ADD_DRAG_TYPE } from './insert-drop';
  import { fitMenu, submenuSpot, type MenuItem } from './structure-menu';

  type Props = { x: number; y: number; items: MenuItem[]; label?: string; draggable?: boolean; onpick: (id: string) => void; onclose: () => void };

  let { x, y, items, label = 'structure', draggable = false, onpick, onclose }: Props = $props();

  let width = $state(0);
  let height = $state(0);
  let subWidth = $state(0);
  let subHeight = $state(0);
  let innerWidth = $state(0);
  let innerHeight = $state(0);
  let root = $state<HTMLDivElement | null>(null);
  let sub = $state<{ item: MenuItem; row: { left: number; right: number; top: number } } | null>(null);

  const view = $derived({ width: innerWidth, height: innerHeight });
  const spot = $derived(fitMenu({ x, y }, { width, height }, view));
  const subSpot = $derived(sub ? submenuSpot(sub.row, { width: subWidth, height: subHeight }, view) : null);

  $effect(() => {
    root?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
  });

  function openSub(item: MenuItem, row: HTMLElement) {
    const box = row.getBoundingClientRect();
    sub = { item, row: { left: box.left, right: box.right, top: box.top } };
  }

  async function openAndFocus(item: MenuItem, row: HTMLElement) {
    openSub(item, row);
    await tick();
    document.querySelector<HTMLElement>(`[data-submenu="${item.id}"] [role=menuitem]`)?.focus();
  }

  function pick(item: MenuItem, row: HTMLElement) {
    if (item.disabled) {
      return;
    }
    if (item.items) {
      void openAndFocus(item, row);
      return;
    }
    onpick(item.id);
    onclose();
  }

  function hover(item: MenuItem, row: HTMLElement) {
    if (item.items) {
      openSub(item, row);
      return;
    }
    sub = null;
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onclose();
      return;
    }
    const target = e.target as HTMLElement;
    const menu = target.closest<HTMLElement>('[role=menu]');
    const rows = [...(menu?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
    const at = rows.indexOf(target);
    const inSub = menu?.hasAttribute('data-submenu');
    const move: Record<string, () => void> = {
      ArrowDown: () => rows[(at + 1) % rows.length]?.focus(),
      ArrowUp: () => rows[(at - 1 + rows.length) % rows.length]?.focus(),
      ArrowRight: () => {
        const item = items.find((i) => i.id === target.dataset.op);
        if (item?.items) {
          void openAndFocus(item, target);
        }
      },
      ArrowLeft: () => {
        if (inSub) {
          const parent = root?.querySelector<HTMLElement>(`[data-op="${sub?.item.id}"]`);
          sub = null;
          parent?.focus();
        }
      }
    };
    if (move[e.key]) {
      e.preventDefault();
      move[e.key]();
    }
  }

  function drag(e: DragEvent, item: MenuItem) {
    e.dataTransfer?.setData(ADD_DRAG_TYPE, item.id);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'copy';
    }
  }
</script>

<svelte:window bind:innerWidth bind:innerHeight onpointerdown={onclose} onkeydown={onKey} />

<div class="menu" role="menu" tabindex="-1" data-testid={`${label}-menu`} bind:this={root} bind:offsetWidth={width} bind:offsetHeight={height} style={`left:${spot.x}px;top:${spot.y}px`} onpointerdown={(e) => e.stopPropagation()}>
  {#each items as item (item.id)}
    <button type="button" role="menuitem" data-op={item.id} aria-disabled={item.disabled ? true : undefined} title={item.disabled} class:disabled={Boolean(item.disabled)} aria-haspopup={item.items ? 'menu' : undefined} aria-expanded={item.items ? sub?.item.id === item.id : undefined} draggable={draggable && !item.still} onclick={(e) => pick(item, e.currentTarget)} onpointerenter={(e) => hover(item, e.currentTarget)} ondragstart={(e) => drag(e, item)} ondragend={onclose}>
      <span>{item.label}</span>
      {#if item.items}<ChevronRight size={12} />{:else if item.shortcut}<kbd>{item.shortcut}</kbd>{/if}
    </button>
  {/each}
</div>

{#if sub && subSpot}
  <div class="menu" role="menu" tabindex="-1" data-testid={`${label}-submenu`} data-submenu={sub.item.id} bind:offsetWidth={subWidth} bind:offsetHeight={subHeight} style={`left:${subSpot.x}px;top:${subSpot.y}px`} onpointerdown={(e) => e.stopPropagation()}>
    {#each sub.item.items ?? [] as item (item.id)}
      <button type="button" role="menuitem" data-op={item.id} draggable={draggable} onclick={() => (onpick(item.id), onclose())} ondragstart={(e) => drag(e, item)} ondragend={onclose}>
        <span>{item.label}</span>
        {#if item.shortcut}<kbd>{item.shortcut}</kbd>{/if}
      </button>
    {/each}
  </div>
{/if}

<style>
  .menu {
    position: fixed;
    z-index: 50;
    display: grid;
    min-width: 160px;
    padding: 4px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-panel);
    color: var(--ui-text);
    box-shadow: 0 0 0 1px var(--ui-border), 0 8px 24px rgb(0 0 0 / 0.25);
    font-size: var(--ui-text-sm);
  }

  button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 6px 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    outline: none;
  }

  button:hover,
  button:focus-visible,
  button[aria-expanded='true'] {
    background: var(--ui-input-hover);
  }

  button.disabled {
    color: var(--ui-text-3);
    cursor: not-allowed;
  }

  kbd {
    color: var(--ui-text-3);
    font: inherit;
    font-size: var(--ui-text-xs);
  }
</style>
