<script lang="ts">
  import { FrameDialog } from '$lib/canvas/frame-dialogs';

  let { onopen }: { onopen: (dialog: FrameDialog) => void } = $props();

  const ENTRIES = [
    { dialog: FrameDialog.Voice, label: 'Voice-over…' },
    { dialog: FrameDialog.Music, label: 'Music…' }
  ] as const;
</script>

<div class="sound" data-testid="frame-sound-section">
  <span>Sound</span>
  {#each ENTRIES as entry (entry.dialog)}
    <button type="button" data-testid={`frame-sound-${entry.dialog}`} onclick={() => onopen(entry.dialog)}>{entry.label}</button>
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
