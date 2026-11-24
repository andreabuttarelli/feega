<script lang="ts">
  import X from '@lucide/svelte/icons/x';

  let { label, onexit }: { label: string; onexit: () => void } = $props();
</script>

<div class="bar" role="status" data-testid="focus-bar">
  <span class="label" data-testid="focus-label">{label}</span>
  <button type="button" data-testid="focus-exit" title="Exit focus (Esc)" onclick={onexit}><X size={12} />Exit focus</button>
</div>

<style>
  .bar {
    position: absolute;
    top: 12px;
    left: 50%;
    z-index: 3;
    display: flex;
    align-items: center;
    gap: 8px;
    transform: translateX(-50%);
    padding: 4px 4px 4px 10px;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-float);
    box-shadow: 0 0 0 1px var(--ui-divider), 0 4px 12px rgb(0 0 0 / 0.15);
    color: var(--ui-text);
    font-size: var(--ui-text-xs);
  }

  .label {
    font-weight: 600;
  }

  button {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
    color: inherit;
    font: inherit;
    cursor: default;
  }

  button:hover {
    background: var(--ui-divider);
  }
</style>
