<script lang="ts">
  import Plug from '@lucide/svelte/icons/plug';
  import Copy from '@lucide/svelte/icons/copy';
  import Check from '@lucide/svelte/icons/check';
  import { env as publicEnv } from '$env/dynamic/public';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import { isLocalMode } from '$lib/local-user';
  import { ConnectMode, connectClients, connectMode } from '$lib/canvas/agent-connect';

  const COPIED_MS = 1500;

  const mode = connectMode(isLocalMode(publicEnv));
  const origin = typeof location === 'undefined' ? 'http://localhost:5173' : location.origin;
  const clients = connectClients(mode, origin);

  let active = $state(clients[0].id);
  let copied = $state<string | null>(null);
  const client = $derived(clients.find((c) => c.id === active) ?? clients[0]);

  async function copy(snippet: string) {
    await navigator.clipboard.writeText(snippet);
    copied = snippet;
    setTimeout(() => (copied = copied === snippet ? null : copied), COPIED_MS);
  }
</script>

<Popover.Root>
  <Popover.Trigger class="connect-btn" data-testid="canvas-connect" title="Connect an AI agent">
    <Plug size={14} />
    <span class="connect-label">Connect</span>
  </Popover.Trigger>
  <Popover.Content class="connect-pop w-[360px]" align="start" data-testid="canvas-connect-menu">
    <div class="head">
      <span class="title">connect an agent</span>
      <span class="sub">
        {mode === ConnectMode.Local ? `Local MCP server for this canvas on ${origin}. Keep feega running.` : 'Remote MCP server. Sign in with your feega account.'}
      </span>
    </div>
    <div class="tabs" role="tablist">
      {#each clients as c (c.id)}
        <button type="button" role="tab" class="tab" aria-selected={c.id === active} onclick={() => (active = c.id)}>{c.name}</button>
      {/each}
    </div>
    <ol class="steps">
      {#each client.steps as step (step.text)}
        <li>
          <span>{step.text}</span>
          {#if step.snippet}
            <div class="snippet">
              <pre>{step.snippet}</pre>
              <button type="button" class="copy" aria-label="Copy" onclick={() => copy(step.snippet ?? '')}>
                {#if copied === step.snippet}<Check size={12} />{:else}<Copy size={12} />{/if}
              </button>
            </div>
          {/if}
        </li>
      {/each}
    </ol>
  </Popover.Content>
</Popover.Root>

<style>
  :global(.connect-btn) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: var(--ui-control-h);
    padding: 0 10px;
    appearance: none;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-secondary);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  :global(.connect-btn:hover),
  :global(.connect-btn[data-state='open']) {
    background: var(--ui-wash);
    color: var(--ui-text);
  }

  :global(.connect-pop) {
    gap: 10px;
    padding: 12px;
    font-size: 12px;
  }

  .head {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .title {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.04em;
  }
  .sub {
    color: var(--ui-text-secondary);
  }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
  }
  .tab {
    height: 24px;
    padding: 0 8px;
    appearance: none;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-secondary);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .tab[aria-selected='true'] {
    background: var(--ui-wash);
    color: var(--ui-text);
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .steps li {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .snippet {
    position: relative;
  }
  .snippet pre {
    margin: 0;
    padding: 8px 30px 8px 8px;
    overflow-x: auto;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-wash);
    font-family: ui-monospace, monospace;
    font-size: 11px;
    white-space: pre;
  }
  .copy {
    position: absolute;
    top: 4px;
    right: 4px;
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    appearance: none;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-panel);
    color: var(--ui-text-secondary);
    cursor: pointer;
  }

  @media (max-width: 480px) {
    .connect-label {
      display: none;
    }
  }
</style>
