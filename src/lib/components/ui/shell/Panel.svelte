<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils.js';
  import { SURFACE, Surface } from './styles';

  let {
    surface = Surface.Panel,
    class: className,
    children,
    ...rest
  }: HTMLAttributes<HTMLElement> & { surface?: Surface; children?: Snippet } = $props();
</script>

<section {...rest} data-slot="shell-panel" data-surface={surface} class={cn('flex min-h-0 min-w-0 flex-col text-ui-text', SURFACE[surface], className)}>
  {@render children?.()}
</section>
