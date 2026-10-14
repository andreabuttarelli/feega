<script lang="ts">
  import { DropdownMenu } from 'bits-ui';
  import { cn } from '$lib/utils.js';
  import { MENU_CONTENT } from './styles';

  let { class: className, sideOffset = 6, align = 'start', ...rest }: DropdownMenu.ContentProps = $props();
</script>

<DropdownMenu.Portal>
  <DropdownMenu.Content {...rest} {sideOffset} {align} data-slot="menu" class={cn(MENU_CONTENT, className)} />
</DropdownMenu.Portal>
