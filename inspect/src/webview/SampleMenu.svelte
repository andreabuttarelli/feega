<script lang="ts">
  import { DropdownMenu } from 'bits-ui';
  import Dices from '@lucide/svelte/icons/dices';
  import { samplesFor, type Target } from './sample-values';

  type Props = { target: Target; onpick: (value: string) => void };

  let { target, onpick }: Props = $props();

  let seed = $state(0);

  const samples = $derived(samplesFor(target));
</script>

{#if samples.length > 0}
  <DropdownMenu.Root onOpenChange={(open) => open && (seed = Date.now())}>
    <DropdownMenu.Trigger class="sample-trigger" aria-label="Pick a sample value" title="Pick a sample value" data-testid="sample-trigger">
      <Dices size={14} />
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content class="dropdown-menu" sideOffset={4} align="end">
        {#each samples as sample (sample.id)}
          <DropdownMenu.Item class="dropdown-item" onSelect={() => onpick(sample.make(seed))} data-testid="sample-item" data-sample={sample.id}>{sample.label}</DropdownMenu.Item>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
{/if}

<style>
  :global(.sample-trigger) {
    position: absolute;
    top: 50%;
    right: 4px;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-3);
    cursor: pointer;
    transform: translateY(-50%);
  }

  :global(.sample-trigger:hover),
  :global(.sample-trigger[data-state='open']) {
    color: var(--ui-accent);
  }
</style>
