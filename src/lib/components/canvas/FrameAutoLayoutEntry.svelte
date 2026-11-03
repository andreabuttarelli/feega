<script lang="ts">
  let { onadd }: { onadd: () => void } = $props();
</script>

<div class="entry">
  <span>Auto layout</span>
  <button type="button" aria-label="Add auto layout" title="Add auto layout ⇧A" data-testid="frame-add-auto-layout" onclick={onadd}>+</button>
</div>

<style>
  .entry {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--ui-space-3) var(--ui-space-4) 0;
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-2);
  }

  button {
    height: var(--ui-control-h);
    padding: 0 var(--ui-space-2);
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-ink);
    cursor: pointer;
  }

  button:hover {
    background: var(--ui-input-hover);
  }
</style>
