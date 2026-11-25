<script lang="ts">
  import X from '@lucide/svelte/icons/x';

  let { label = 'Dismiss', onclose }: { label?: string; onclose: () => void } = $props();
</script>

<button type="button" class="close" title={label} aria-label={label} data-testid="close" onclick={onclose}><X size={12} /></button>

<style>
  .close {
    display: grid;
    flex: none;
    place-items: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-2);
    cursor: pointer;
  }

  .close:hover,
  .close:focus-visible {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .close:focus-visible {
    outline: 1px solid var(--ui-accent);
  }
</style>
