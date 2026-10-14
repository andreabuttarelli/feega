<script lang="ts">
  import { cn } from '$lib/utils.js';
  import { SECTION_LABEL } from './styles';

  let { label }: { label: string } = $props();
</script>

<div data-slot="menu-label" class={cn('px-2 pt-2 pb-1', SECTION_LABEL)}>{label}</div>
