<script lang="ts">
  import Copy from '@lucide/svelte/icons/copy';
  import Target from '@lucide/svelte/icons/target';
  import ComponentPreview from './ComponentPreview.svelte';
  import { mainNav } from '$lib/canvas/main-nav.svelte';
  import { CANVAS_DRAG_COMPONENT, componentClipText, serializeComponentDrag, type ComponentDrag } from '$lib/canvas/component-drag';
  import type { ProjectComponent } from '$lib/canvas/project-components';

  let { groups, title, projectId, canvasId }: { groups: ProjectComponent[]; title: string; projectId: string; canvasId: string } = $props();

  const label = (variant: Record<string, string>) => Object.values(variant).join(' · ');

  function drag(e: DragEvent, item: ComponentDrag) {
    e.dataTransfer?.setData(CANVAS_DRAG_COMPONENT, serializeComponentDrag(item));
    e.dataTransfer!.effectAllowed = 'copy';
    const tile = e.currentTarget as HTMLElement;
    const preview = tile.querySelector<HTMLElement>('.preview') ?? tile;
    e.dataTransfer?.setDragImage(preview, preview.clientWidth / 2, preview.clientHeight / 2);
  }

  function copy(item: ComponentDrag) {
    void navigator.clipboard?.writeText(componentClipText(item));
  }

  function copyKey(e: KeyboardEvent, item: ComponentDrag) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
      e.preventDefault();
      copy(item);
    }
  }
</script>

{#if groups.length}
  <section class="components" data-testid="canvas-components">
    <h4>{title}</h4>
    <div class="grid" role="list">
      {#each groups as group (group.key)}
        {#each group.variants as v (v.compId)}
          {@const item = { frameId: group.frameId, compId: v.compId }}
          {@const main = { compId: v.compId, home: group.home }}
          {@const variant = group.variants.length > 1 ? label(v.variant) : ''}
          <div class="item" draggable="true" role="listitem" tabindex="0" data-testid="component-row" data-comp={v.compId} title={variant ? `${group.name} · ${variant}` : group.name} ondragstart={(e) => drag(e, item)} onkeydown={(e) => copyKey(e, item)}>
            <ComponentPreview ask={{ projectId, canvasId, frameId: group.frameId, compId: v.compId, revision: group.revision }} />
            <span class="name">{group.name}</span>
            {#if variant}<span class="variant">{variant}</span>{/if}
            <div class="actions">
              <button type="button" class="action" data-testid="component-show-main" aria-label="Show main" title={mainNav.where(main)?.label ?? 'Show main'} onclick={() => mainNav.go(main)}>
                <Target size={12} />
              </button>
              <button type="button" class="action" data-testid="component-copy" aria-label="Copy" title="Copy" onclick={() => copy(item)}>
                <Copy size={12} />
              </button>
            </div>
          </div>
        {/each}
      {/each}
    </div>
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
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--ui-space-2);
  }

  .item {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 4px;
    border-radius: var(--ui-radius-md);
    color: var(--ui-text);
    font-size: var(--ui-type-caption);
    cursor: grab;
  }

  .item:hover,
  .item:focus-visible {
    background: var(--ui-hover);
    outline: none;
  }

  .name,
  .variant {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .variant {
    margin-top: -4px;
    color: var(--ui-text-tertiary);
  }

  .actions {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 2px;
    opacity: 0;
  }

  .item:hover .actions,
  .item:focus-within .actions {
    opacity: 1;
  }

  .action {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-panel);
    color: var(--ui-text-secondary);
  }
</style>
