<script lang="ts">
  import { apiEnhance } from '$lib/dashboard/api-enhance';
  import { Button } from '$lib/components/ui/button/index.js';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';

  let { projects = [], action = '?/project' }: { projects?: { id: string; name: string }[]; action?: string } = $props();

  let form = $state<HTMLFormElement | null>(null);
  let chosen = $state<HTMLInputElement | null>(null);

  function startIn(id: string) {
    if (!chosen || !form) {
      return;
    }
    chosen.value = id;
    form.requestSubmit();
  }
</script>

<form bind:this={form} method="POST" {action} use:apiEnhance class="new-canvas" data-testid="new-canvas-form">
  <input bind:this={chosen} type="hidden" name="projectId" value="" />
  <Button type="submit" data-testid="new-canvas" onclick={() => chosen && (chosen.value = '')}>new canvas</Button>
  {#if projects.length}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger class="new-canvas-more" data-testid="new-canvas-project" aria-label="New canvas in a project">
        <ChevronDown size={14} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" collisionPadding={8} class="max-h-[60vh] w-[230px] overflow-y-auto">
        <DropdownMenu.Label>New canvas in</DropdownMenu.Label>
        {#each projects as p (p.id)}
          <DropdownMenu.Item data-testid="new-canvas-in-{p.id}" onSelect={() => startIn(p.id)}>{p.name}</DropdownMenu.Item>
        {/each}
        <DropdownMenu.Separator />
        <DropdownMenu.Item data-testid="new-canvas-in-new" onSelect={() => startIn('')}>a new project</DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {/if}
</form>

<style>
  .new-canvas {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  :global(.new-canvas-more) {
    display: grid;
    place-items: center;
    width: var(--ui-control-h);
    height: var(--ui-control-h);
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-icon-ink);
    cursor: pointer;
  }

  :global(.new-canvas-more:hover) {
    background: var(--ui-wash);
    color: var(--ui-text);
  }
</style>
