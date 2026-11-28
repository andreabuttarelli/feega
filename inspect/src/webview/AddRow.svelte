<script lang="ts">
  import Type from '@lucide/svelte/icons/type';
  import Heading from '@lucide/svelte/icons/heading';
  import RectangleHorizontal from '@lucide/svelte/icons/rectangle-horizontal';
  import Link from '@lucide/svelte/icons/link';
  import ImageIcon from '@lucide/svelte/icons/image';
  import Square from '@lucide/svelte/icons/square-dashed';
  import Ellipsis from '@lucide/svelte/icons/ellipsis';
  import { AddKind } from '@feega/live-edit/add-node';

  import type { Component } from 'svelte';
  import { ADD_DRAG_TYPE } from './insert-drop';
  import { ADD_ITEMS } from './structure-menu';

  type Props = { disabled: boolean; onadd: (kind: AddKind) => void; onmore: (event: MouseEvent) => void };

  let { disabled, onadd, onmore }: Props = $props();

  const ICONS: Record<string, Component> = {
    [AddKind.Text]: Type,
    [AddKind.Heading]: Heading,
    [AddKind.Button]: RectangleHorizontal,
    [AddKind.Link]: Link,
    [AddKind.Image]: ImageIcon,
    [AddKind.Container]: Square
  };

  const QUICK = ADD_ITEMS.filter((item) => ICONS[item.id]);
</script>

<div class="row" role="toolbar" aria-label="Add element" data-testid="add-row">
  {#each QUICK as item (item.id)}
    {@const Icon = ICONS[item.id]}
    <button type="button" class="add" title={`Add ${item.label}`} aria-label={`Add ${item.label}`} data-testid={`add-kind-${item.id}`} {disabled} draggable={!disabled} ondragstart={(e) => e.dataTransfer?.setData(ADD_DRAG_TYPE, item.id)} onclick={() => onadd(item.id as AddKind)}><Icon size={15} /></button>
  {/each}
  <button type="button" class="add" title="More elements" aria-label="More elements" data-testid="add-button" {disabled} onclick={onmore}><Ellipsis size={15} /></button>
</div>

<style>
  .row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    box-sizing: border-box;
    width: calc(100% - 16px);
    margin: 8px;
    padding: 4px;
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-lg);
    background: var(--ui-input);
  }

  .add {
    display: grid;
    place-items: center;
    height: 28px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-2);
    cursor: pointer;
  }

  .add:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .add:hover:not(:disabled),
  .add:focus-visible {
    background: color-mix(in srgb, var(--ui-accent) 14%, transparent);
    color: var(--ui-text);
  }
</style>
