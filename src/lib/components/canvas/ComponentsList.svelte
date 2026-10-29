<script lang="ts">
  import Diamond from '@lucide/svelte/icons/diamond';
  import Copy from '@lucide/svelte/icons/copy';
  import Target from '@lucide/svelte/icons/target';
  import { mainNav } from '$lib/canvas/main-nav.svelte';
  import { canvasComponents } from '$lib/canvas/canvas-components.svelte';
  import { CANVAS_DRAG_COMPONENT, componentClipText, serializeComponentDrag, type ComponentDrag } from '$lib/canvas/component-drag';
  import type { ComponentGroup } from '$lib/motion/canvas-components';

  type ListedGroup = ComponentGroup & { thumb?: string | null };

  let { groups = null, title = 'Components' }: { groups?: ListedGroup[] | null; title?: string } = $props();

  const shown = $derived<ListedGroup[]>(groups ?? canvasComponents.groups);

  const label = (variant: Record<string, string>) => Object.values(variant).join(' · ');

  function drag(e: DragEvent, item: ComponentDrag) {
    e.dataTransfer?.setData(CANVAS_DRAG_COMPONENT, serializeComponentDrag(item));
    e.dataTransfer!.effectAllowed = 'copy';
    const row = e.currentTarget as HTMLElement;
    const preview = row.closest('.group')?.querySelector<HTMLImageElement>('img.thumb') ?? row;
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

{#if shown.length}
  <section class="components" data-testid="canvas-components">
    <h4>{title}</h4>
    {#each shown as group (group.key)}
      <div class="group">
        <span class="name">
          {#if group.thumb}<img class="thumb" src={group.thumb} alt="" loading="lazy" />{:else}<Diamond size={14} />{/if}
          {group.name}
        </span>
        {#each group.variants as v (v.compId)}
          {@const item = { frameId: group.frameId, compId: v.compId }}
          {@const main = { compId: v.compId, home: group.home }}
          <div class="row" draggable="true" role="listitem" tabindex="0" data-testid="component-row" data-comp={v.compId} ondragstart={(e) => drag(e, item)} onkeydown={(e) => copyKey(e, item)}>
            <span class="variant">{label(v.variant) || 'Main'}</span>
            <button type="button" class="copy" data-testid="component-show-main" aria-label="Show main" title={mainNav.where(main)?.label ?? 'Show main'} onclick={() => mainNav.go(main)}>
              <Target size={12} />
            </button>
            <button type="button" class="copy" data-testid="component-copy" aria-label="Copy" title="Copy" onclick={() => copy(item)}>
              <Copy size={12} />
            </button>
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

  .thumb {
    width: 32px;
    height: 20px;
    object-fit: cover;
    border-radius: var(--ui-radius-xs);
    background: var(--ui-surface);
  }

  .row {
    display: flex;
    align-items: center;
    padding: 4px 4px 4px 22px;
    border-radius: var(--ui-radius-sm);
    color: var(--ui-text);
    font-size: var(--ui-type-caption);
    cursor: grab;
  }

  .row:hover,
  .row:focus-visible {
    background: var(--ui-hover);
    outline: none;
  }

  .variant {
    flex: 1 1 auto;
    min-width: 0;
  }

  .copy {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-secondary);
    opacity: 0;
  }

  .row:hover .copy,
  .row:focus-within .copy {
    opacity: 1;
  }
</style>
