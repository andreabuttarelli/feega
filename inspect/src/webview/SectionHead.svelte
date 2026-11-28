<script lang="ts">
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import type { Snippet } from 'svelte';

  type Props = { title: string; open: boolean; ontoggle: () => void; actions?: Snippet };

  let { title, open, ontoggle, actions }: Props = $props();
</script>

<div class="head">
  <button type="button" class="title" aria-expanded={open} onclick={ontoggle}>
    <span class="chevron" class:shut={!open}><ChevronDown size={12} /></span>{title}
  </button>
  {#if actions}<div class="actions">{@render actions()}</div>{/if}
</div>

<style>
  .head {
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 8px 0 4px;
  }

  .title {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 4px;
    height: 100%;
    padding: 0;
    border: 0;
    background: none;
    box-shadow: none;
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-xs);
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }

  .chevron {
    display: grid;
    place-items: center;
    width: 16px;
    color: var(--ui-text-3);
    transition: transform 120ms ease;
  }

  .chevron.shut {
    transform: rotate(-90deg);
  }

  .actions {
    display: flex;
    gap: 2px;
  }
</style>
