<script lang="ts">
  import { DropdownMenu } from 'bits-ui';
  import { cn } from '$lib/utils.js';
  import { MENU_CONTENT } from './styles';
  import { Closes, openLayer } from './dismiss';

  let { ref = $bindable(null), class: className, sideOffset = 6, align = 'start', ...rest }: DropdownMenu.ContentProps = $props();

  $effect(() => {
    if (ref) {
      return openLayer(() => {}, Closes.ItsOwner);
    }
  });
</script>

<DropdownMenu.Portal>
  <DropdownMenu.Content bind:ref {...rest} {sideOffset} {align} data-slot="menu" class={cn(MENU_CONTENT, className)} />
</DropdownMenu.Portal>
