<script lang="ts">
  import type { Component } from 'svelte';
  import AlignLeft from '@lucide/svelte/icons/text-align-start';
  import AlignCenter from '@lucide/svelte/icons/text-align-center';
  import AlignRight from '@lucide/svelte/icons/text-align-end';
  import { SegmentIcon, type Segment } from '$lib/motion/segments';

  let { name, options, value, onchange }: { name: string; options: Segment[]; value: string; onchange: (value: string) => void } = $props();

  const ICONS: Record<SegmentIcon, Component<{ size?: number }>> = {
    [SegmentIcon.AlignLeft]: AlignLeft,
    [SegmentIcon.AlignCenter]: AlignCenter,
    [SegmentIcon.AlignRight]: AlignRight
  };
</script>

<div class="segmented" role="radiogroup" aria-label={name} data-segmented={name}>
  {#each options as option (option.value)}
    {@const Icon = option.icon ? ICONS[option.icon] : null}
    <button type="button" role="radio" aria-checked={option.value === value} aria-label={option.label} title={option.label} class:on={option.value === value} onclick={() => onchange(option.value)}>
      {#if Icon}<Icon size={14} />{:else}{option.label}{/if}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: flex;
    flex: 1;
    min-width: 0;
    height: 28px;
    padding: 2px;
    gap: 2px;
    background: var(--ui-field);
  }

  button {
    flex: 1;
    min-width: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 4px;
    border: 0;
    border-radius: 0;
    background: none;
    color: var(--ui-ink-3);
    font: inherit;
    font-size: var(--ui-text-xs);
    white-space: nowrap;
    overflow: hidden;
    cursor: pointer;
  }

  button:hover {
    color: var(--ui-ink);
  }

  button.on {
    background: var(--ui-bg);
    color: var(--ui-ink);
  }

  button:focus-visible {
    outline: 1px solid var(--ui-accent);
  }

  @media (pointer: coarse) {
    .segmented {
      height: 44px;
    }
  }
</style>
