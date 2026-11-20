<script lang="ts">
  import type { StructureOp } from '@feega/live-edit/structure';
  import { MENU_ITEMS } from './structure-menu';

  type Props = { x: number; y: number; onpick: (op: StructureOp) => void; onclose: () => void };

  let { x, y, onpick, onclose }: Props = $props();
</script>

<svelte:window onpointerdown={onclose} onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="menu" role="menu" data-testid="structure-menu" style={`left:${x}px;top:${y}px`} onpointerdown={(e) => e.stopPropagation()}>
  {#each MENU_ITEMS as item (item.op)}
    <button type="button" role="menuitem" data-op={item.op} onclick={() => (onpick(item.op), onclose())}>
      <span>{item.label}</span>
      <kbd>{item.shortcut}</kbd>
    </button>
  {/each}
</div>

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
  }

  button:hover {
    background: var(--ui-input-hover);
  }

  kbd {
    color: var(--ui-text-3);
    font: inherit;
    font-size: var(--ui-text-xs);
  }
</style>
