<script lang="ts">
  import type { Snippet } from 'svelte';
  import IconButton from '$lib/components/motion/IconButton.svelte';
  import { Action } from '$lib/motion/actions';

  let { title, testid, onclose, children }: { title: string; testid: string; onclose: () => void; children: Snippet } = $props();
</script>

<div class="scrim" role="presentation" onclick={onclose}></div>
<div class="card" role="dialog" aria-modal="true" aria-label={title} data-testid={testid}>
  <header>
    <h2>{title}</h2>
    <IconButton action={Action.Close} onclick={onclose} />
  </header>
  <div class="body">{@render children()}</div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.35);
    z-index: 200;
  }

  .card {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(420px, calc(100vw - 32px));
    max-height: calc(100vh - 64px);
    z-index: 201;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    color: var(--ui-ink);
    font-size: 13px;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-panel-raised);
    box-shadow: var(--ui-shadow-float);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .body {
    position: relative;
    overflow: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .body :global(.menu) {
    position: static;
    box-shadow: none;
    padding: 0;
    max-height: none;
  }
</style>
