<script lang="ts" module>
  import type { ActionId } from '$lib/motion/actions';

  export type MenuItem = { id?: ActionId; label?: string; run: () => void; disabled?: boolean; pressed?: boolean };
  export type MenuBlock = { section: string; items: MenuItem[] };
</script>

<script lang="ts">
  import { ACTIONS, shortcutOf } from '$lib/motion/actions';
  import type { Point } from '$lib/motion/press-menu';

  type Props = { sections: MenuBlock[]; onclose: () => void; at?: Point | null; label?: string };

  let { sections, onclose, at = null, label = 'More actions' }: Props = $props();

  const MARGIN_PX = 12;
  const SHEET = '(max-width: 759px)';

  const clamp = (value: number, max: number) => Math.max(MARGIN_PX, Math.min(value, max - MARGIN_PX));

  function atPoint(node: HTMLElement, point: Point) {
    node.style.setProperty('--room', `${innerHeight - 2 * MARGIN_PX}px`);
    const box = node.getBoundingClientRect();
    node.style.position = 'fixed';
    node.style.right = 'auto';
    node.style.bottom = 'auto';
    node.style.left = `${clamp(point.x, innerWidth - box.width)}px`;
    node.style.top = `${clamp(point.y, innerHeight - box.height)}px`;
  }

  const fitAbove = (node: HTMLElement) => {
    if (at && !matchMedia(SHEET).matches) {
      atPoint(node, at);
      return;
    }
    const top = node.parentElement?.getBoundingClientRect().top ?? innerHeight;
    node.style.setProperty('--room', `${Math.max(top - MARGIN_PX, 0)}px`);
  };

  const pick = (item: MenuItem) => {
    onclose();
    item.run();
  };
</script>

<div class="overflow" use:fitAbove role="menu" aria-label={label} data-testid="overflow-menu">
  {#each sections.filter((s) => s.items.length) as block (block.section)}
    <span class="head">{block.section}</span>
    {#each block.items as item, i (item.id ?? `${block.section}-${i}`)}
      {@const Icon = item.id ? ACTIONS[item.id].icon : null}
      <button type="button" role={item.pressed === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={item.pressed} disabled={item.disabled} onclick={() => pick(item)}>
        <i aria-hidden="true">{#if Icon}<Icon size={14} />{/if}</i>
        <span>{item.label ?? (item.id ? ACTIONS[item.id].name : '')}</span>
        {#if item.id && shortcutOf(item.id)}<kbd>{shortcutOf(item.id)}</kbd>{/if}
      </button>
    {/each}
  {/each}
</div>

<style>
  .overflow {
    position: absolute;
    bottom: calc(100% + 6px);
    right: 0;
    z-index: 40;
    display: flex;
    flex-direction: column;
    width: 280px;
    max-height: min(var(--room, 70vh), 640px);
    overflow-y: auto;
    padding: var(--ui-space-2);
    background: var(--ui-raised);
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.14);
  }

  .head {
    padding: var(--ui-space-3) var(--ui-space-3) var(--ui-space-1);
    font-size: var(--ui-text-xs);
    color: var(--ui-text-3);
  }

  button {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    min-height: var(--ui-hit);
    padding: 0 var(--ui-space-3);
    border: 0;
    background: none;
    color: var(--ui-ink);
    font: inherit;
    font-size: var(--ui-text-sm);
    text-align: left;
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    background: var(--ui-hover);
  }

  button:disabled {
    color: var(--ui-text-3);
    cursor: default;
  }

  button[aria-checked='true'] {
    color: var(--ui-accent);
  }

  i {
    display: inline-flex;
    width: 16px;
    color: var(--ui-text-2);
  }

  kbd {
    margin-left: auto;
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    color: var(--ui-text-3);
  }

  @media (max-width: 759px) {
    .overflow {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      width: auto;
      max-height: 70vh;
      padding-bottom: calc(var(--ui-space-3) + env(safe-area-inset-bottom));
    }
  }
</style>
