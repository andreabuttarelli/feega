<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils.js';
  import { FOCUS_RING, Reveal } from './styles';

  const INDENT_PX = 12;
  const BASE_PAD_PX = 8;

  let {
    label,
    meta,
    depth = 0,
    selected = false,
    reveal = Reveal.Hover,
    icon,
    trailing,
    class: className,
    ...rest
  }: HTMLAttributes<HTMLDivElement> & {
    label: string;
    meta?: string;
    depth?: number;
    selected?: boolean;
    reveal?: Reveal;
    icon?: Snippet;
    trailing?: Snippet;
  } = $props();
</script>

<div
  {...rest}
  data-slot="row"
  aria-selected={selected}
  style:padding-left="{BASE_PAD_PX + depth * INDENT_PX}px"
  class={cn(
    'group/row flex h-(--ui-row) min-w-0 items-center gap-2 rounded-sm pr-1 text-ui-label text-ui-text transition-colors duration-(--ui-dur-fast) pointer-coarse:h-11 hover:bg-ui-wash aria-selected:bg-ui-selected aria-selected:text-ui-accent-text [&_svg]:size-(--ui-icon-sm) [&_svg]:shrink-0',
    FOCUS_RING,
    className
  )}
>
  {#if icon}
    <span class="flex shrink-0 text-ui-icon group-aria-selected/row:text-ui-accent-text">{@render icon()}</span>
  {/if}
  <span class="min-w-0 flex-1 truncate">{label}</span>
  {#if meta}
    <span class="shrink-0 font-(family-name:--ui-mono) text-ui-caption text-ui-text-3 tabular-nums">{meta}</span>
  {/if}
  {#if trailing}
    <span
      class={cn(
        'flex shrink-0 items-center gap-0.5',
        reveal === Reveal.Hover && 'opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 pointer-coarse:opacity-100'
      )}
    >
      {@render trailing()}
    </span>
  {/if}
</div>
