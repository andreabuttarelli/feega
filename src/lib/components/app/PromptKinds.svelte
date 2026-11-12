<script lang="ts">
  import type { Component } from 'svelte';
  import Clapperboard from '@lucide/svelte/icons/clapperboard';
  import AppWindow from '@lucide/svelte/icons/app-window';
  import { PROMPT_KINDS, PROMPT_KIND_ORDER, PromptKind } from '$lib/home/prompt-kinds';

  let { kind = $bindable() }: { kind: PromptKind } = $props();

  const KIND_ICONS: Record<PromptKind, Component<{ size?: number }>> = {
    [PromptKind.Motion]: Clapperboard,
    [PromptKind.Website]: AppWindow
  };
</script>

<div class="kinds" role="group" aria-label="What to make" data-testid="prompt-kinds">
  {#each PROMPT_KIND_ORDER as option (option)}
    {@const Icon = KIND_ICONS[option]}
    <button type="button" data-kind={option} aria-pressed={kind === option} onclick={() => (kind = option)}>
      <Icon size={16} />
      <span>{PROMPT_KINDS[option].label}</span>
    </button>
  {/each}
</div>

<style>
  .kinds {
    display: flex;
    gap: 2px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  button {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: var(--ui-space-2);
    height: var(--ui-row-lg);
    padding: 0 var(--ui-space-3);
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-secondary);
    font: inherit;
    font-size: var(--ui-type-body);
    white-space: nowrap;
    cursor: pointer;
    transition: background var(--ui-dur-fast) var(--ui-ease), color var(--ui-dur-fast) var(--ui-ease);
  }

  button:hover {
    color: var(--ui-text);
  }

  button[aria-pressed='true'] {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  button:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }

  @media (pointer: coarse) {
    button {
      height: 44px;
    }
  }
</style>
