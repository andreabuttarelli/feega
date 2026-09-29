<script lang="ts">
  import { NODE_KIND_ICON, NODE_KIND_LABEL } from '$lib/canvas/node-label';
  import { NODE_EMPTY_HINT } from '$lib/canvas/node-empty';
  import type { NodeType } from '$lib/canvas/node-data';

  let { type }: { type: NodeType } = $props();

  const Icon = $derived(NODE_KIND_ICON[type]);
</script>

<div class="empty-node">
  <span class="empty-icon"><Icon size={20} strokeWidth={1.6} /></span>
  <p class="empty-title">{NODE_KIND_LABEL[type]}</p>
  <p class="empty-hint">{NODE_EMPTY_HINT[type]}</p>
</div>

<style>
  .empty-node {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 100%;
    padding: 16px;
    text-align: center;
    background: var(--paper);
    border: 1px dashed var(--line-2);
  }
  .empty-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    color: var(--ink-soft);
    background: var(--paper-2);
    border: 1px solid var(--line);
  }
  .empty-title {
    margin: 4px 0 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
  }
  .empty-hint {
    margin: 0;
    max-width: 28ch;
    font-size: 12px;
    line-height: 1.4;
    color: var(--ink-soft);
  }
</style>
