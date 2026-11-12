<script lang="ts">
  import { DropdownMenu } from 'bits-ui';
  import { cn } from '$lib/utils.js';
  import { MENU_CONTENT } from './styles';
  import { Closes, openLayer } from './dismiss';
  import { lastInput } from './last-input';
  import { leaveMenu } from '$lib/canvas/key-region.svelte';

  let { ref = $bindable(null), class: className, sideOffset = 6, align = 'start', ...rest }: DropdownMenu.ContentProps = $props();

  const VIEWPORT_MARGIN = 8;
  let trigger: Element | null = null;

  $effect(() => {
    if (ref) {
      trigger = document.querySelector(`[aria-controls="${ref.id}"]`);
      return openLayer(() => {}, Closes.ItsOwner);
    }
  });
</script>

<DropdownMenu.Portal>
  <DropdownMenu.Content bind:ref {...rest} onCloseAutoFocus={(e) => leaveMenu(trigger, lastInput(), e)} {sideOffset} {align} collisionPadding={VIEWPORT_MARGIN} data-slot="menu" class={cn(MENU_CONTENT, 'max-h-(--bits-floating-available-height) overflow-y-auto', className)} />
</DropdownMenu.Portal>
