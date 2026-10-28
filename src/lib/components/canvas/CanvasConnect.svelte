<script lang="ts">
  import Plug from '@lucide/svelte/icons/plug';
  import Copy from '@lucide/svelte/icons/copy';
  import Check from '@lucide/svelte/icons/check';
  import { env as publicEnv } from '$env/dynamic/public';
  import * as Popover from '$lib/components/ui/popover/index.js';
  import { isLocalMode } from '$lib/local-user';
  import { ConnectMode, connectClients, connectMode } from '$lib/canvas/agent-connect';

  const COPIED_MS = 1500;
  const SIDE_OFFSET = 8;
  const DEFAULT_MARK = '<circle cx="8" cy="8" r="5.5"/>';
  const MARKS: Record<string, string> = {
    'claude-code': '<path d="M3 4.5l3.5 3.5L3 11.5M8.5 12H13"/>',
    claude: '<path d="M8 2.5v11M2.5 8h11M4.1 4.1l7.8 7.8M11.9 4.1l-7.8 7.8"/>',
    codex: '<path d="M8 2l5 3v6l-5 3-5-3V5z"/>',
    cursor: '<path d="M8 2l5 3v6l-5 3-5-3V5zM8 8l5-3M8 8L3 5M8 8v6"/>',
    'claude-desktop': '<rect x="2" y="3" width="12" height="8" rx="1.5"/><path d="M6 13.5h4M8 11v2.5"/>'
  };

  const mode = connectMode(isLocalMode(publicEnv));
  const origin = typeof location === 'undefined' ? 'http://localhost:5173' : location.origin;
  const clients = connectClients(mode, origin);
  const subtitle =
    mode === ConnectMode.Local ? `Local MCP server on ${origin}. Keep feega running.` : 'Remote MCP server. Sign in with your feega account.';

  let active = $state(clients[0].id);
  let copied = $state<string | null>(null);
  const client = $derived(clients.find((c) => c.id === active) ?? clients[0]);

  function onTabKey(e: KeyboardEvent, i: number) {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) {
      return;
    }

    e.preventDefault();
    const next = clients[(i + step + clients.length) % clients.length];
    active = next.id;
    document.getElementById(`connect-tab-${next.id}`)?.focus();
  }

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
  <Popover.Content class="connect-pop" sideOffset={SIDE_OFFSET} align="end" data-testid="canvas-connect-menu">
    <div class="head">
      <span class="title">Connect an agent</span>
      <span class="sub">{subtitle}</span>
    </div>
    <div class="tabs" role="tablist" aria-label="Client">
      {#each clients as c, i (c.id)}
        <button
          type="button"
          role="tab"
          class="tab"
          id={`connect-tab-${c.id}`}
          aria-selected={c.id === active}
          tabindex={c.id === active ? 0 : -1}
          onclick={() => (active = c.id)}
          onkeydown={(e) => onTabKey(e, i)}
        >
          <svg class="mark" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            {@html MARKS[c.id] ?? DEFAULT_MARK}
          </svg>
          <span>{c.name}</span>
        </button>
      {/each}
    </div>
    <ol class="steps" role="tabpanel" aria-labelledby={`connect-tab-${client.id}`}>
      {#each client.steps as step, n (step.text)}
        <li>
          <span class="num">{n + 1}</span>
          <div class="body">
            <span class="text">{step.text}</span>
            {#if step.snippet}
              <div class="snippet">
                <pre>{step.snippet}</pre>
                <button type="button" class="copy" aria-label={copied === step.snippet ? 'Copied' : 'Copy'} onclick={() => copy(step.snippet ?? '')}>
                  {#if copied === step.snippet}<Check size={12} /><span>Copied</span>{:else}<Copy size={12} />{/if}
                </button>
              </div>
            {/if}
          </div>
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
    width: 380px;
    gap: 14px;
    padding: 14px;
    font-size: 12px;
    letter-spacing: normal;
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-md);
  }

  .head {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .title {
    font-size: 13px;
    font-weight: 500;
    letter-spacing: normal;
  }
  .sub {
    color: var(--ui-text-secondary);
    line-height: 1.4;
  }

  .tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    padding: 2px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
  }
  .tab {
    display: inline-flex;
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 26px;
    padding: 0 8px;
    appearance: none;
    border: 0;
    border-radius: var(--ui-radius-xs);
    background: transparent;
    color: var(--ui-text-secondary);
    font: inherit;
    font-weight: 500;
    letter-spacing: normal;
    white-space: nowrap;
    cursor: pointer;
  }
  .tab:hover {
    color: var(--ui-text);
  }
  .tab:focus-visible {
    outline: 2px solid var(--ui-accent);
    outline-offset: 1px;
  }
  .tab[aria-selected='true'] {
    background: var(--ui-panel-raised);
    color: var(--ui-text);
    box-shadow: 0 0 0 1px var(--ui-divider);
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .steps li {
    display: flex;
    gap: 10px;
  }
  .num {
    display: grid;
    flex: none;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 9999px;
    background: var(--ui-input);
    color: var(--ui-text-secondary);
    font-size: 11px;
    font-weight: 500;
  }
  .body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  .text {
    padding-top: 1px;
    color: var(--ui-text);
    line-height: 1.45;
    letter-spacing: normal;
  }

  .snippet {
    position: relative;
  }
  .snippet pre {
    margin: 0;
    padding: 10px 88px 10px 10px;
    overflow-x: auto;
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    font-family: var(--ui-mono);
    font-size: 12px;
    line-height: 1.5;
    letter-spacing: normal;
    white-space: pre;
  }
  .copy {
    position: absolute;
    top: 5px;
    right: 5px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 22px;
    padding: 0 6px;
    appearance: none;
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-xs);
    background: var(--ui-panel-raised);
    color: var(--ui-text-secondary);
    font: inherit;
    font-size: 11px;
    cursor: pointer;
  }
  .copy:hover,
  .copy:focus-visible {
    color: var(--ui-text);
  }

  @media (max-width: 480px) {
    .connect-label {
      display: none;
    }
  }
</style>
