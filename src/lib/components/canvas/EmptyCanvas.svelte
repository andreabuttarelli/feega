<script lang="ts">
  import { EMPTY_ACTIONS, EmptyAction } from '$lib/canvas/empty-canvas';

  let { onaction }: { onaction: (action: EmptyAction) => void } = $props();

  const prompt = EMPTY_ACTIONS[0];
  const quick = EMPTY_ACTIONS.slice(1);
</script>

<div class="empty" data-testid="empty-canvas">
  <button type="button" class="prompt" data-empty-action={prompt.action} onclick={() => onaction(prompt.action)}>{prompt.label}</button>
  <div class="quick">
    {#each quick as item (item.action)}
      <button type="button" class="pill" data-empty-action={item.action} onclick={() => onaction(item.action)}>{item.label}</button>
    {/each}
  </div>
</div>

<style>
  .empty {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--ui-space-3);
    width: min(480px, calc(100% - 32px));
    transform: translate(-50%, -50%);
    pointer-events: none;
    animation: settle 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  @keyframes settle {
    from {
      opacity: 0;
      transform: translate(-50%, calc(-50% + 6px));
    }
  }

  button {
    pointer-events: auto;
    border: 0;
    font: inherit;
    cursor: pointer;
  }

  button:focus-visible {
    outline: none;
    box-shadow: var(--ui-focus);
  }

  .prompt {
    width: 100%;
    min-height: 56px;
    padding: 0 var(--ui-space-4);
    background: var(--ui-bg);
    color: var(--ui-ink-3);
    font-size: var(--ui-text-lg);
    text-align: left;
    box-shadow: 0 0 0 1px var(--ui-line-strong);
    transition: box-shadow 0.2s ease;
  }

  .prompt:hover {
    box-shadow: 0 0 0 1px var(--ui-accent);
  }

  .quick {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--ui-space-2);
  }

  .pill {
    min-height: 36px;
    padding: 0 var(--ui-space-4);
    border-radius: 9999px;
    background: var(--ui-bg);
    color: var(--ui-ink-2);
    font-size: var(--ui-text-sm);
  }

  .pill:hover {
    background: var(--ui-hover);
    color: var(--ui-ink);
  }

  @media (prefers-reduced-motion: reduce) {
    .empty {
      animation: none;
    }
  }

  @media (max-width: 640px) {
    .pill {
      min-height: 44px;
    }
  }
</style>
