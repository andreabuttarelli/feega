<script lang="ts">
  import type { Snippet } from 'svelte';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import { cn } from '$lib/utils.js';
  import { FOCUS_RING, Fold, SECTION_TITLE } from './styles';

  let {
    title,
    fold = Fold.Fixed,
    actions,
    class: className,
    children
  }: {
    title: string;
    fold?: Fold;
    actions?: Snippet;
    class?: string;
    children?: Snippet;
  } = $props();

  let open = $state(fold !== Fold.Closed);
  const foldable = $derived(fold !== Fold.Fixed);
</script>

<section data-slot="section" class={cn('ui-section py-2', className)}>
  <header class="flex h-10 items-center gap-1 pr-1.5">
    {#if foldable}
      <button
        type="button"
        aria-expanded={open}
        class={cn('flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1 pr-1 pl-3 hover:bg-ui-wash', SECTION_TITLE, FOCUS_RING)}
        onclick={() => (open = !open)}
      >
        <span class="truncate">{title}</span>
        <ChevronRight class={cn('ml-auto size-3 shrink-0 transition-transform duration-(--ui-dur-fast)', open && 'rotate-90')} aria-hidden="true" />
      </button>
    {:else}
      <h3 class={cn('min-w-0 flex-1 truncate pl-3', SECTION_TITLE)}>{title}</h3>
    {/if}
    {#if actions}
      <div class="flex shrink-0 items-center gap-0.5">{@render actions()}</div>
    {/if}
  </header>
  {#if open}
    <div class="flex flex-col gap-1.5 px-3 pb-2">{@render children?.()}</div>
  {/if}
</section>
