<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
</script>

<svelte:boundary onerror={(error) => console.error('[canvas] node failed to render', error)}>
  {@render children()}

  {#snippet failed(error, reset)}
    <div class="node-failed" role="alert">
      <strong>This node could not be shown</strong>
      <span>{messageOf(error)}</span>
      <button type="button" class="nodrag" onclick={reset}>Retry</button>
    </div>
  {/snippet}
</svelte:boundary>

<style>
  .node-failed {
    display: flex;
    flex-direction: column;
    gap: 6px;
    height: 100%;
    padding: 12px;
    font-size: 12px;
    color: var(--ink, #111);
    background: var(--paper, #fff);
    border: 1px solid #d33;
    overflow: auto;
  }
  .node-failed span {
    color: #a22;
    word-break: break-word;
  }
  .node-failed button {
    align-self: flex-start;
    padding: 3px 8px;
    font: inherit;
    border: 1px solid var(--line, #e5e5e5);
    background: var(--paper, #fff);
    cursor: pointer;
  }
</style>
