<script lang="ts">
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import LayoutGrid from '@lucide/svelte/icons/layout-grid';

  import type { Component } from 'svelte';

  type Props = { title?: string; hint: string; testid: string; icon?: Component; disabled?: boolean; onopen: (event: MouseEvent) => void };

  let { title = 'Open canvas', hint, testid, icon: Icon = LayoutGrid, disabled = false, onopen }: Props = $props();
</script>

<button type="button" class="banner" data-testid={testid} {disabled} onclick={onopen}>
  <span class="glyph"><Icon size={14} /></span>
  <span class="text">
    <b>{title}</b>
    <span>{hint}</span>
  </span>
  <ChevronRight size={14} />
</button>

<style>
  .banner {
    display: flex;
    align-items: center;
    gap: 8px;
    box-sizing: border-box;
    width: calc(100% - 16px);
    margin: 8px;
    padding: 8px 10px;
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-lg);
    background: var(--ui-input);
    color: var(--ui-text-2);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .banner:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .banner:hover:not(:disabled),
  .banner:focus-visible {
    border-color: var(--ui-accent);
    background: color-mix(in srgb, var(--ui-accent) 10%, var(--ui-input));
    color: var(--ui-text);
  }

  .glyph {
    display: grid;
    flex: none;
    place-items: center;
  }

  .text {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
    font-size: var(--ui-text-xs);
  }

  .text b {
    color: var(--ui-text);
    font-size: var(--ui-text-sm);
    font-weight: 500;
  }

  .text span {
    line-height: 1.3;
  }
</style>
