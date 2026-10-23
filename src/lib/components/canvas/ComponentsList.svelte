<script lang="ts">
  import Diamond from '@lucide/svelte/icons/diamond';
  import { canvasComponents } from '$lib/canvas/canvas-components.svelte';
  import { CANVAS_DRAG_COMPONENT, serializeComponentDrag } from '$lib/canvas/component-drag';

  const groups = $derived(canvasComponents.groups);

  const label = (variant: Record<string, string>) => Object.values(variant).join(' · ');

  function drag(e: DragEvent, frameId: string, compId: string) {
    e.dataTransfer?.setData(CANVAS_DRAG_COMPONENT, serializeComponentDrag({ frameId, compId }));
    e.dataTransfer!.effectAllowed = 'copy';
  }
</script>

{#if groups.length}
  <section class="components" data-testid="canvas-components">
    <h4>Components</h4>
    {#each groups as group (group.key)}
      <div class="group">
        <span class="name"><Diamond size={14} />{group.name}</span>
        {#each group.variants as v (v.compId)}
          <div class="row" draggable="true" role="listitem" data-testid="component-row" data-comp={v.compId} ondragstart={(e) => drag(e, group.frameId, v.compId)}>
            {label(v.variant) || 'Main'}
          </div>
        {/each}
      </div>
    {/each}
  </section>
{/if}

<style>
  .components {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    padding: 0 0 var(--ui-space-3);
    margin-bottom: var(--ui-space-3);
    border-bottom: 1px solid var(--ui-divider);
  }

  h4 {
    margin: 0;
    font-size: var(--ui-type-caption);
    font-weight: var(--ui-weight-semibold);
    color: var(--ui-text-secondary);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .name {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    color: #9747ff;
    font-size: var(--ui-type-caption);
    font-weight: 600;
  }

  .row {
    padding: 4px 8px 4px 22px;
    border-radius: var(--ui-radius-sm);
    color: var(--ui-text);
    font-size: var(--ui-type-caption);
    cursor: grab;
  }

  .row:hover {
    background: var(--ui-hover);
  }
</style>
