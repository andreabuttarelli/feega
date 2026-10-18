<script lang="ts">
  let { renderer, reason = null }: { renderer: string; reason?: string | null } = $props();
</script>

<p class="renderer-badge" data-testid="renderer-badge" data-renderer={renderer}>{renderer}{reason ? ` · ${reason}` : ''}</p>

<style>
  .renderer-badge {
    position: fixed;
    z-index: 50;
    left: 8px;
    bottom: 8px;
    margin: 0;
    padding: 2px 6px;
    font: 11px/1.4 var(--sans, sans-serif);
    color: var(--ui-text-secondary, #6e6e73);
    background: var(--ui-panel, #fff);
    border: 1px solid var(--ui-divider, #e5e5e5);
    pointer-events: none;
  }
</style>
