<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils.js';
  import { Placement } from './styles';

  let {
    label,
    placement = Placement.Inline,
    class: className,
    children,
    ...rest
  }: HTMLAttributes<HTMLDivElement> & { label: string; placement?: Placement; children?: Snippet } = $props();

  const PLACEMENT: Record<Placement, string> = {
    [Placement.Inline]: 'gap-0.5',
    [Placement.Floating]: 'gap-0.5 rounded-lg bg-ui-raised p-1 shadow-ui-float'
  };
</script>

<div {...rest} role="toolbar" aria-label={label} data-slot="toolbar" data-placement={placement} class={cn('flex items-center', PLACEMENT[placement], className)}>
  {@render children?.()}
</div>
