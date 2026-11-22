<script lang="ts">
  import { eventAttrs } from './analytics/attrs';

  let { command, onCopy }: { command: string; onCopy?: () => void } = $props();

  const FEEDBACK_MS = 1600;
  let copied = $state(false);

  function copy() {
    navigator.clipboard?.writeText(command);
    onCopy?.();
    copied = true;
    setTimeout(() => (copied = false), FEEDBACK_MS);
  }
</script>

<div class="field">
  <span class="prompt" aria-hidden="true">$</span>
  <code>{command}</code>
  <button type="button" aria-label={copied ? 'copied' : 'copy command'} onclick={copy} {...eventAttrs('install_copy', { command })}>
    {#if copied}
      <span class="done">copied</span>
    {/if}
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {#if copied}
        <path d="M5 12l5 5 9-10" />
      {:else}
        <rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" />
      {/if}
    </svg>
  </button>
</div>

<style>
  .field {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    padding: 0 6px 0 14px;
    border: 1px solid var(--site-line, rgb(255 255 255 / 0.15));
    border-radius: var(--ui-radius-md, 6px);
    background: #141414;
    color: #fff;
    text-align: left;
  }

  .prompt {
    color: rgb(255 255 255 / 0.4);
    font-family: 'Fragment Mono', monospace;
    user-select: none;
  }

  code {
    flex: 1;
    min-width: 0;
    padding: 12px 0;
    overflow-x: auto;
    white-space: nowrap;
    font-family: 'Fragment Mono', monospace;
    font-size: 14px;
    scrollbar-width: none;
  }

  code::-webkit-scrollbar {
    display: none;
  }

  button {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    padding: 8px;
    border: 0;
    border-radius: var(--ui-radius-sm, 4px);
    background: transparent;
    color: rgb(255 255 255 / 0.7);
    font: inherit;
    cursor: pointer;
  }

  button:hover,
  button:focus-visible {
    background: rgb(255 255 255 / 0.1);
    color: #fff;
    outline: none;
  }

  .done {
    color: #ff5100;
    font-size: 13px;
  }
</style>
