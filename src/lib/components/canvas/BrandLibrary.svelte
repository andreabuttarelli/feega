<script lang="ts">
  import { CANVAS_DRAG_FILLED_NODE, serializeFilledNodeDrag } from '$lib/canvas/drag-payload';
  import { CANVAS_DRAG_MEDIUM } from '$lib/canvas/new-node';
  import { libraryDrag, type LibraryItem } from '$lib/canvas/brand-library';

  let { items, thumb, empty }: { items: LibraryItem[]; thumb: (assetId: string) => string | null; empty: string } = $props();

  const groups = $derived(
    items.reduce<Array<{ name: string; items: LibraryItem[] }>>((acc, item) => {
      const name = item.group ?? '';
      const last = acc.at(-1);
      if (last && last.name === name) {
        last.items.push(item);
        return acc;
      }
      return [...acc, { name, items: [item] }];
    }, [])
  );

  function onDragStart(e: DragEvent, item: LibraryItem) {
    const drag = libraryDrag(item);
    if (!drag || !e.dataTransfer) {
      return;
    }

    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(CANVAS_DRAG_FILLED_NODE, serializeFilledNodeDrag(drag));
    e.dataTransfer.setData(CANVAS_DRAG_MEDIUM, drag.type);
  }
</script>

{#if items.length === 0}
  <p class="hint">{empty}</p>
{/if}

{#each groups as group (group.name)}
  {#if group.name}<h4 class="section">{group.name}</h4>{/if}
  <div class="grid">
    {#each group.items as item (item.id)}
      {@const src = item.assetId ? thumb(item.assetId) : null}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="tile" draggable="true" data-item-id={item.id} title={item.title} ondragstart={(e) => onDragStart(e, item)}>
        {#if src}
          <img {src} alt="" loading="lazy" decoding="async" />
        {:else}
          <span class="text">{item.title}</span>
        {/if}
        {#if item.mediaType === 'video'}<span class="badge">Video</span>{/if}
        <span class="caption">
          <span class="title">{item.title}</span>
          {#if item.subtitle}<span class="sub">{item.subtitle}</span>{/if}
        </span>
      </div>
    {/each}
  </div>
{/each}

<style>
  .section {
    margin: 10px 2px 6px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ui-text-tertiary);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    border-radius: var(--ui-radius-md);
    overflow: hidden;
    background: var(--ui-input);
    cursor: grab;
  }
  .tile img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    display: block;
  }
  .text {
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    padding: 8px;
    font-size: 12px;
    text-align: center;
    color: var(--ui-text-secondary);
    overflow: hidden;
  }
  .badge {
    position: absolute;
    top: 6px;
    left: 6px;
    padding: 1px 6px;
    border-radius: var(--ui-radius-full);
    background: rgb(0 0 0 / 0.6);
    color: #fff;
    font-size: 10px;
  }
  .caption {
    display: flex;
    flex-direction: column;
    padding: 5px 6px;
    min-width: 0;
  }
  .title,
  .sub {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .title {
    font-size: 12px;
    color: var(--ui-text);
  }
  .sub {
    font-size: 11px;
    color: var(--ui-text-secondary);
  }

  .hint {
    padding: 16px 4px;
    text-align: center;
    font-size: 12.5px;
    color: var(--ui-text-secondary);
  }
</style>
