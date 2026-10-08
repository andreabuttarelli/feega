<script lang="ts">
  import type { MotionDoc } from '$lib/motion/doc';
  import { Caption, type ActionId } from '$lib/motion/actions';
  import { PickMode, clipActions } from '$lib/motion/clip-bar';
  import IconButton from './IconButton.svelte';

  type Props = { doc: MotionDoc; selection: readonly string[]; pick: PickMode; onrun: (id: ActionId) => void; ondone: () => void };

  let { doc, selection, pick, onrun, ondone }: Props = $props();

  const actions = $derived(clipActions(doc, selection));
</script>

{#if actions.length}
  <div class="clip-bar" role="toolbar" aria-label="Clip" data-testid="clip-bar">
    {#if pick === PickMode.Many}
      <span class="count">{selection.length} selected</span>
      <button type="button" class="done" onclick={ondone}>Done</button>
    {/if}
    {#each actions as id (id)}
      <IconButton action={id} size={16} caption={Caption.Wide} onclick={() => onrun(id)} />
    {/each}
  </div>
{/if}

<style>
  .clip-bar {
    display: flex;
    align-items: center;
    gap: var(--ui-hit-gap);
    min-height: 52px;
    padding: 0 var(--ui-space-3);
    overflow-x: auto;
    background: var(--ui-raised);
    flex-shrink: 0;
  }

  .count {
    font-size: var(--ui-text-sm);
    color: var(--ui-text-2);
    white-space: nowrap;
  }

  .done {
    height: var(--ui-hit);
    padding: 0 var(--ui-space-3);
    border: 0;
    border-radius: 9999px;
    background: var(--ui-accent);
    color: #fff;
    font: inherit;
    font-size: var(--ui-text-sm);
    cursor: pointer;
  }
</style>
