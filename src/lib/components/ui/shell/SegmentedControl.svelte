<script lang="ts" module>
  import type { Component } from 'svelte';

  export type SegmentOption = { value: string; label: string; icon?: Component; shortcut?: string };
</script>

<script lang="ts">
  import { cn } from '$lib/utils.js';
  import { nextIndex } from '../control/types';
  import Hint from './Hint.svelte';
  import { FOCUS_RING } from './styles';

  let {
    label,
    options,
    value,
    onchange,
    class: className
  }: {
    label: string;
    options: SegmentOption[];
    value: string;
    onchange: (value: string) => void;
    class?: string;
  } = $props();

  let buttons = $state<HTMLButtonElement[]>([]);

  const selected = $derived(options.findIndex((o) => o.value === value));
  const focusable = $derived(selected < 0 ? 0 : selected);

  function keydown(event: KeyboardEvent, index: number) {
    const next = nextIndex(index, event.key, options.length);
    if (next === null) {
      return;
    }
    event.preventDefault();
    buttons[next]?.focus();
    onchange(options[next].value);
  }

  const ITEM = cn(
    'inline-flex h-6 min-w-6 flex-1 items-center justify-center gap-1.5 rounded-sm px-2 text-ui-label font-medium text-ui-text-2 transition-colors duration-(--ui-dur-fast) pointer-coarse:h-10 hover:text-ui-text aria-checked:bg-ui-raised aria-checked:text-ui-text aria-checked:shadow-[0_1px_2px_rgb(0_0_0/0.14)] [&_svg]:size-(--ui-icon-sm)',
    FOCUS_RING
  );
</script>

<div role="radiogroup" aria-label={label} data-slot="segmented-control" class={cn('inline-flex min-w-0 gap-0.5 rounded-md bg-ui-input p-0.5', className)}>
  {#each options as option, i (option.value)}
    {@const Icon = option.icon}
    {#if Icon}
      <Hint label={option.label} shortcut={option.shortcut}>
        {#snippet children(trigger)}
          <button
            {...trigger}
            bind:this={buttons[i]}
            type="button"
            role="radio"
            aria-checked={i === selected}
            aria-label={option.label}
            tabindex={i === focusable ? 0 : -1}
            class={ITEM}
            onclick={() => onchange(option.value)}
            onkeydown={(e) => keydown(e, i)}
          >
            <Icon aria-hidden="true" />
          </button>
        {/snippet}
      </Hint>
    {:else}
      <button
        bind:this={buttons[i]}
        type="button"
        role="radio"
        aria-checked={i === selected}
        tabindex={i === focusable ? 0 : -1}
        class={ITEM}
        onclick={() => onchange(option.value)}
        onkeydown={(e) => keydown(e, i)}
      >
        {option.label}
      </button>
    {/if}
  {/each}
</div>
