<script lang="ts">
  import Copy from '@lucide/svelte/icons/copy';
  import Check from '@lucide/svelte/icons/check';
  import { AGENT_DOCS_URL, homeAgentClients, type ConnectStep } from '$lib/canvas/agent-connect';

  const COPIED_MS = 1500;
  const clients = homeAgentClients();

  let active = $state(clients[0].id);
  let copied = $state<string | null>(null);
  const client = $derived(clients.find((c) => c.id === active) ?? clients[0]);
  const groups = $derived([
    { id: 'mcp', label: 'mcp', steps: client.mcp },
    { id: 'cli', label: 'cli', steps: client.cli }
  ]);

  async function copy(snippet: string) {
    await navigator.clipboard.writeText(snippet);
    copied = snippet;
    setTimeout(() => (copied = copied === snippet ? null : copied), COPIED_MS);
  }

  const snippetsOf = (steps: ConnectStep[]) => steps.filter((s) => s.snippet);
</script>

<section class="agent" data-testid="home-agent" aria-labelledby="agent-heading">
  <h2 id="agent-heading">connect your agent</h2>
  <div class="tabs" role="tablist" aria-label="Agent">
    {#each clients as c (c.id)}
      <button type="button" role="tab" id={`agent-tab-${c.id}`} data-testid={`agent-tab-${c.id}`} aria-selected={c.id === active} onclick={() => (active = c.id)}>{c.name}</button>
    {/each}
  </div>
  <div class="panel" role="tabpanel" aria-labelledby={`agent-tab-${client.id}`}>
    {#each groups as group (group.id)}
      <h3>{group.label}</h3>
      {#each snippetsOf(group.steps) as step (step.snippet)}
        <div class="snippet" data-testid="agent-snippet">
          <pre>{step.snippet}</pre>
          <button type="button" class="copy" data-testid="agent-copy" aria-label={copied === step.snippet ? 'Copied' : 'Copy'} onclick={() => copy(step.snippet ?? '')}>
            {#if copied === step.snippet}<Check size={12} /><span>Copied</span>{:else}<Copy size={12} />{/if}
          </button>
        </div>
      {/each}
    {/each}
  </div>
  <a class="docs" href={AGENT_DOCS_URL} target="_blank" rel="noopener" data-testid="agent-docs">setup guide on docs.feega.app</a>
</section>

<style>
  .agent {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3);
    padding: var(--ui-space-4);
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-md);
    background: var(--ui-panel-raised);
  }

  h2,
  h3 {
    margin: 0;
    font-family: var(--sans);
    font-size: var(--ui-type-section);
    font-weight: var(--ui-weight-semibold);
    text-transform: uppercase;
    letter-spacing: var(--ui-tracking-caps);
    color: var(--ui-text-tertiary);
  }

  .tabs {
    display: flex;
    gap: var(--ui-space-1);
  }

  .tabs button {
    height: var(--ui-row);
    padding: 0 var(--ui-space-3);
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-secondary);
    font: inherit;
    font-size: var(--ui-type-label);
    cursor: pointer;
  }

  .tabs button[aria-selected='true'] {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .tabs button:focus-visible,
  .copy:focus-visible,
  .docs:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }

  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
  }

  .snippet {
    position: relative;
  }

  pre {
    margin: 0;
    padding: var(--ui-space-3) 88px var(--ui-space-3) var(--ui-space-3);
    overflow-x: auto;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    font-family: var(--ui-mono);
    font-size: 12px;
    line-height: 1.5;
    white-space: pre;
  }

  .copy {
    position: absolute;
    top: 6px;
    right: 6px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 24px;
    padding: 0 var(--ui-space-2);
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-xs);
    background: var(--ui-panel-raised);
    color: var(--ui-text-secondary);
    font: inherit;
    font-size: 11px;
    cursor: pointer;
  }

  .docs {
    align-self: flex-start;
    font-size: var(--ui-type-label);
    color: var(--ui-text);
    text-decoration: underline;
    text-decoration-color: var(--ui-divider-strong);
    text-underline-offset: 3px;
  }
</style>
