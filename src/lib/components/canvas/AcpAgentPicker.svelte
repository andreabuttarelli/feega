<script lang="ts">
  import { AGENT_STATUS, AgentStatus, statusOf } from '$lib/acp/agent-status';
  import type { DetectedAgent } from '$lib/acp/detected-agent';

  type Props = {
    agents: DetectedAgent[];
    chosen: string | null;
    open?: boolean;
    refreshing?: boolean;
    onchoose: (id: string | null) => void;
    onrefresh: () => void;
  };

  let { agents, chosen, open = $bindable(false), refreshing = false, onchoose, onrefresh }: Props = $props();

  const CLOUD_LABEL = 'Feega cloud (credits)';
  const COPIED_MS = 1500;

  let copied = $state<string | null>(null);

  const current = $derived(agents.find((a) => a.id === chosen) ?? null);

  function choose(id: string | null) {
    onchoose(id);
    open = false;
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text).catch(() => {});
    copied = text;
    setTimeout(() => (copied = copied === text ? null : copied), COPIED_MS);
  }
</script>

<div class="picker" data-testid="acp-agent-picker">
  <button type="button" class="trigger" aria-haspopup="listbox" aria-expanded={open} onclick={() => (open = !open)} data-testid="acp-agent-trigger">
    <span class="label">Agent</span>
    <span class="value">{current ? current.name : CLOUD_LABEL}</span>
    <span class="caret" aria-hidden="true">▾</span>
  </button>

  {#if open}
    <ul class="menu" role="listbox" aria-label="Agent">
      <li class="row" data-agent="cloud">
        <button type="button" class="pick" role="option" aria-checked={chosen === null} aria-selected={chosen === null} onclick={() => choose(null)} data-testid="acp-agent-cloud">
          <span class="name">{CLOUD_LABEL}</span>
        </button>
      </li>
      {#each agents as a (a.id)}
        {@const status = statusOf(a)}
        {@const row = AGENT_STATUS[status]}
        {@const command = row.copy(a)}
        <li class="row" class:is-off={!row.usable} data-agent={a.id}>
          <button type="button" class="pick" role="option" aria-checked={chosen === a.id} aria-selected={chosen === a.id} disabled={!row.usable} onclick={() => choose(a.id)}>
            <span class="name">{a.name}</span>
            {#if a.version}<span class="version">{a.version}</span>{/if}
            <span class="badge" data-status={status}>{row.label}</span>
          </button>
          {#if command}
            <div class="hint">
              <code>{command}</code>
              <button type="button" class="copy" onclick={() => copy(command)} data-testid="acp-agent-copy">{copied === command ? 'Copied' : 'Copy'}</button>
            </div>
          {/if}
        </li>
      {/each}
      <li class="foot">
        <button type="button" class="refresh" disabled={refreshing} onclick={onrefresh} data-testid="acp-agent-refresh">{refreshing ? 'Detecting…' : 'Detect again'}</button>
      </li>
    </ul>
  {/if}
</div>

<style>
  .picker {
    position: relative;
    padding: var(--ui-space-2) var(--ui-space-3);
    border-bottom: 1px solid var(--ui-divider);
  }

  .trigger {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    width: 100%;
    height: 28px;
    padding: 0 var(--ui-space-2);
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    cursor: pointer;
  }

  .label {
    color: var(--ui-text-secondary);
  }

  .value {
    flex: 1;
    text-align: left;
  }

  .menu {
    position: absolute;
    z-index: 10;
    left: var(--ui-space-3);
    right: var(--ui-space-3);
    top: calc(100% - var(--ui-space-1));
    max-height: 420px;
    overflow: auto;
    margin: 0;
    padding: var(--ui-space-1);
    list-style: none;
    border-radius: var(--ui-radius-md);
    background: var(--ui-surface, var(--ui-input));
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.18), inset 0 0 0 1px var(--ui-divider);
  }

  .row {
    padding: 2px 0;
  }

  .pick {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    width: 100%;
    padding: var(--ui-space-1) var(--ui-space-2);
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .pick:hover:not(:disabled),
  .pick[aria-checked='true'] {
    background: var(--ui-input);
  }

  .pick:disabled {
    cursor: default;
  }

  .is-off .name,
  .is-off .version {
    color: var(--ui-text-secondary);
    opacity: 0.6;
  }

  .name {
    flex: 1;
  }

  .version {
    color: var(--ui-text-secondary);
    font-size: var(--ui-type-caption);
    font-variant-numeric: tabular-nums;
  }

  .badge {
    padding: 0 var(--ui-space-1);
    border-radius: var(--ui-radius-xs);
    background: var(--ui-input);
    color: var(--ui-text-secondary);
    font-size: var(--ui-type-caption);
  }

  .badge[data-status='ready'] {
    color: var(--ui-success, #2f9e5b);
  }

  .badge[data-status='needs_login'] {
    color: var(--ui-warning, #c98a14);
  }

  .hint {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    padding: 0 var(--ui-space-2) var(--ui-space-1);
  }

  .hint code {
    flex: 1;
    overflow: hidden;
    color: var(--ui-text-secondary);
    font-size: var(--ui-type-caption);
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .copy,
  .refresh {
    border: 0;
    border-radius: var(--ui-radius-sm);
    padding: 2px var(--ui-space-2);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-type-caption);
    cursor: pointer;
  }

  .foot {
    padding: var(--ui-space-1) var(--ui-space-2);
    border-top: 1px solid var(--ui-divider);
    margin-top: var(--ui-space-1);
  }
</style>
