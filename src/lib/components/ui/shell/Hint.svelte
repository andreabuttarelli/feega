<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Tooltip } from 'bits-ui';
  import Kbd from './Kbd.svelte';
  import { Side } from './styles';

  let {
    label,
    shortcut,
    side = Side.Top,
    children
  }: {
    label: string;
    shortcut?: string;
    side?: Side;
    children: Snippet<[Record<string, unknown>]>;
  } = $props();
</script>

<Tooltip.Provider delayDuration={350} skipDelayDuration={200}>
  <Tooltip.Root>
    <Tooltip.Trigger>
      {#snippet child({ props })}
        {@render children(props)}
      {/snippet}
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content
        data-slot="hint"
        {side}
        sideOffset={6}
        class="z-50 inline-flex items-center gap-2 rounded-sm bg-ui-tooltip px-2 py-1 text-ui-label font-medium text-ui-tooltip-ink shadow-ui-raised data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0"
      >
        {label}
        {#if shortcut}
          <Kbd {shortcut} class="opacity-70" />
        {/if}
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
</Tooltip.Provider>
