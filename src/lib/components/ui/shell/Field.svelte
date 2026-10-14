<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils.js';
  import { FieldLayout } from './styles';

  let {
    label,
    hint,
    id,
    layout = FieldLayout.Inline,
    class: className,
    children
  }: {
    label: string;
    hint?: string;
    id?: string;
    layout?: FieldLayout;
    class?: string;
    children?: Snippet;
  } = $props();

  const LAYOUT: Record<FieldLayout, string> = {
    [FieldLayout.Inline]: 'grid grid-cols-[minmax(64px,88px)_minmax(0,1fr)] items-center gap-x-2',
    [FieldLayout.Stack]: 'flex flex-col gap-1'
  };
</script>

<div data-slot="field" data-layout={layout} class={cn('min-h-(--ui-row-lg) min-w-0', LAYOUT[layout], className)}>
  <label for={id} class="truncate text-ui-label text-ui-text-2">{label}</label>
  <div class="flex min-w-0 items-center gap-1">{@render children?.()}</div>
  {#if hint}
    <p class="col-start-2 text-ui-caption leading-(--ui-leading) text-ui-text-3">{hint}</p>
  {/if}
</div>
