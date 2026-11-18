<script lang="ts">
  import { LocalOff, isOff } from '$lib/local-user';
  import { ADDABLE_LABEL, type Addable } from '$lib/canvas/addable';
  import { ADDABLE_ICON } from '$lib/canvas/addable-icons';
  import { AI_PANEL_NODES } from '$lib/canvas/ai-panel';
  import { CANVAS_DRAG_MEDIUM } from '$lib/canvas/new-node';
  import { insertRequest } from '$lib/canvas/insert-request.svelte';

  const nodes = AI_PANEL_NODES.filter(() => !isOff(LocalOff.AiNodes));

  function startDrag(e: DragEvent, what: Addable) {
    e.dataTransfer?.setData(CANVAS_DRAG_MEDIUM, what);
  }
</script>

<div class="list" data-testid="ai-panel">
  {#each nodes as what (what)}
    {@const Icon = ADDABLE_ICON[what]}
    <button type="button" class="row" data-ai-node={what} draggable="true" ondragstart={(e) => startDrag(e, what)} onclick={() => insertRequest.ask(what)}>
      <Icon size={18} strokeWidth={1.7} />
      <span>{ADDABLE_LABEL[what]}</span>
    </button>
  {/each}
</div>

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    height: var(--ui-row-lg, 36px);
    padding: 0 10px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text);
    font-size: 12px;
    text-align: left;
    cursor: grab;
  }

  .row:hover {
    background: var(--ui-hover);
  }

  .row:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }
</style>
