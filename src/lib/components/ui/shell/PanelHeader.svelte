<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils.js';

  let {
    title,
    leading,
    actions,
    class: className
  }: {
    title: string;
    leading?: Snippet;
    actions?: Snippet;
    class?: string;
  } = $props();
</script>

<header data-slot="panel-header" class={cn('flex h-(--ui-header-h) shrink-0 items-center gap-2 border-b border-ui-divider pr-1.5 pl-3', className)}>
  {@render leading?.()}
  <h2 class="min-w-0 flex-1 truncate text-ui-title font-semibold tracking-[var(--ui-tracking-title)] text-ui-text">{title}</h2>
  {#if actions}
    <div class="flex shrink-0 items-center gap-0.5">{@render actions()}</div>
  {/if}
</header>
