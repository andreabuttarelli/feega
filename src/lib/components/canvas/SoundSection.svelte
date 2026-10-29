<script lang="ts">
  import { FRAME_DIALOG_ACTIONS } from '$lib/canvas/frame-dialogs';
  import type { SelectionActionId } from '$lib/canvas/selection-actions';

  let { onrun }: { onrun: (id: SelectionActionId) => void } = $props();

  const ENTRIES = [
    { id: 'frame-voice', label: 'Voice-over…' },
    { id: 'frame-music', label: 'Music…' }
  ] as const satisfies readonly { id: SelectionActionId & keyof typeof FRAME_DIALOG_ACTIONS; label: string }[];
</script>

<div class="sound" data-testid="frame-sound-section">
  <span>Sound</span>
  {#each ENTRIES as entry (entry.id)}
    <button type="button" data-testid={`frame-sound-${FRAME_DIALOG_ACTIONS[entry.id]}`} onclick={() => onrun(entry.id)}>{entry.label}</button>
  {/each}
</div>

<style>
  .sound {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    border-bottom: 1px solid var(--ui-line);
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-2);
  }

  span {
    flex: 1;
  }

  button {
    height: 28px;
    padding: 0 10px;
    border: 1px solid transparent;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-ink);
    font: inherit;
    cursor: pointer;
  }

  button:hover {
    border-color: var(--ui-line);
  }
</style>
