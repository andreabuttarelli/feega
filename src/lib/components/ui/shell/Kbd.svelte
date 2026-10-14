<script lang="ts">
  import { cn } from '$lib/utils.js';
  import { currentPlatform, shortcutKeys } from './shortcut';

  let { shortcut, class: className }: { shortcut: string; class?: string } = $props();

  const keys = $derived(shortcutKeys(shortcut, currentPlatform()));
</script>

<kbd data-slot="kbd" class={cn('inline-flex items-center gap-0.5 font-(family-name:--ui-mono) text-ui-caption leading-none', className)}>
  {#each keys as key, i (i)}
    <span class="inline-flex h-4 min-w-4 items-center justify-center rounded-xs bg-current/12 px-1">{key}</span>
  {/each}
</kbd>
