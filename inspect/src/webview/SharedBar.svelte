<script lang="ts">
  type Props = { instances: number; reason?: string; ondetach: () => void; ondismiss: () => void; onmute: () => void };

  let { instances, reason, ondetach, ondismiss, onmute }: Props = $props();
</script>

<div class="shared" role="status" data-testid="shared-bar">
  <span class="text">Edits {instances} instances</span>
  <button type="button" data-action="detach" disabled={Boolean(reason)} title={reason} onclick={ondetach}>Detach</button>
  <button type="button" data-action="dismiss" onclick={ondismiss}>Dismiss</button>
  <button type="button" data-action="mute" onclick={onmute}>Don't show again</button>
</div>

<style>
  .shared {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    margin: 0 12px 8px;
    padding: 6px 8px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
    font-size: var(--ui-text-xs);
    color: var(--ui-text-2);
  }

  .text {
    flex: 1;
    color: var(--ui-text);
  }

  button {
    border: 0;
    background: none;
    padding: 0;
    color: var(--ui-accent);
    font: inherit;
    cursor: pointer;
  }

  button:disabled {
    color: var(--ui-text-3);
    cursor: not-allowed;
  }
</style>
