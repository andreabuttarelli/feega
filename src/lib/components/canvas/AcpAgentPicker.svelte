<script lang="ts">
  import { AGENT_STATUS, readyFirst, statusOf } from '$lib/acp/agent-status';
  import { markOf, type AgentMark } from '$lib/acp/agent-marks';
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

  const CLOUD_LABEL = 'Feega cloud';
  const CLOUD_ID = 'cloud';

  const current = $derived(agents.find((a) => a.id === chosen) ?? null);
  const ordered = $derived(readyFirst(agents));

  function choose(id: string | null) {
    onchoose(id);
    open = false;
  }
</script>

{#snippet mark(m: AgentMark | null, name: string)}
  {#if m}
    <svg class="mark" viewBox={m.viewBox} fill="currentColor" fill-rule={m.evenodd ? 'evenodd' : 'nonzero'} aria-hidden="true">
      {#each m.paths as d}<path {d} />{/each}
    </svg>
  {:else}
    <span class="mark monogram" aria-hidden="true">{name.slice(0, 1)}</span>
  {/if}
{/snippet}

<div class="picker" data-testid="acp-agent-picker">
  <button type="button" class="trigger" aria-haspopup="listbox" aria-expanded={open} onclick={() => (open = !open)} data-testid="acp-agent-trigger">
    <span class="label">Agent</span>
    <span class="value">{current ? current.name : CLOUD_LABEL}</span>
    <span class="caret" aria-hidden="true">▾</span>
  </button>

  {#if open}
    <div class="menu" role="listbox" aria-label="Agent">
      <ul class="grid">
        <li class="row" data-agent="cloud">
          <button type="button" class="tile" role="option" aria-checked={chosen === null} aria-selected={chosen === null} onclick={() => choose(null)} data-testid="acp-agent-cloud">
            {@render mark(markOf(CLOUD_ID), CLOUD_LABEL)}
            <span class="name">{CLOUD_LABEL}</span>
          </button>
        </li>
        {#each ordered as a (a.id)}
          {@const row = AGENT_STATUS[statusOf(a)]}
          <li class="row" class:is-off={!row.usable} data-agent={a.id}>
            <button type="button" class="tile" role="option" aria-checked={chosen === a.id} aria-selected={chosen === a.id} disabled={!row.usable} title={row.tip ?? undefined} onclick={() => choose(a.id)}>
              {@render mark(markOf(a.id), a.name)}
              <span class="name">{a.name}</span>
              {#if row.tip}<span class="dot" data-dot title={row.tip}></span>{/if}
            </button>
          </li>
        {/each}
      </ul>
      <button type="button" class="refresh" class:is-spinning={refreshing} disabled={refreshing} onclick={onrefresh} title="Detect again" aria-label="Detect again" data-testid="acp-agent-refresh">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
      </button>
    </div>
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
    height: 24px;
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
    max-height: min(560px, 75vh);
    overflow: auto;
    padding: var(--ui-space-3);
    border-radius: var(--ui-radius-md);
    background: var(--ui-surface, var(--ui-input));
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.18), inset 0 0 0 1px var(--ui-divider);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(68px, 1fr));
    gap: var(--ui-space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tile {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--ui-space-2);
    width: 100%;
    min-height: 76px;
    padding: var(--ui-space-3) var(--ui-space-2);
    border: 0;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    cursor: pointer;
    transition: background-color 120ms ease, box-shadow 120ms ease;
  }

  .tile:hover:not(:disabled) {
    box-shadow: inset 0 0 0 1px var(--ui-divider);
  }

  .tile[aria-checked='true'] {
    box-shadow: inset 0 0 0 2px var(--ui-accent, currentColor);
  }

  .tile:disabled {
    cursor: default;
  }

  .is-off .tile {
    opacity: 0.45;
  }

  .mark {
    width: 24px;
    height: 24px;
    flex: none;
  }

  .monogram {
    display: grid;
    place-items: center;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-divider);
    font-weight: 600;
    text-transform: uppercase;
  }

  .name {
    max-width: 100%;
    overflow: hidden;
    font-size: var(--ui-type-caption);
    line-height: 1.2;
    text-align: center;
    overflow-wrap: anywhere;
  }

  .dot {
    position: absolute;
    top: var(--ui-space-2);
    right: var(--ui-space-2);
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ui-warning, #c98a14);
  }

  .is-off .dot {
    background: var(--ui-text-secondary);
  }

  .refresh {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    margin: var(--ui-space-2) 0 0 auto;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-secondary);
    cursor: pointer;
  }

  .refresh:hover:not(:disabled) {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .refresh svg {
    width: 14px;
    height: 14px;
  }

  .is-spinning svg {
    animation: spin 800ms linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
