<script lang="ts">
  import Bot from '@lucide/svelte/icons/bot';
  import { tip } from '$lib/motion/tooltip';
  import { Keep, RejectOutcome, type AgentChange, type Choice, type EventConflict, type RejectResult } from '$lib/canvas/reject-plan';

  let {
    load,
    reject,
    nameOf
  }: {
    load: () => Promise<AgentChange[]>;
    reject: (eventIds: number[], choices: Choice[], confirm: boolean) => Promise<RejectResult | null>;
    nameOf: (nodeId: string | null) => string;
  } = $props();

  const LABEL = 'Agent changes';
  const VERB: Record<string, string> = {
    'node.create': 'created',
    'node.update': 'changed',
    'node.delete': 'deleted',
    'edge.create': 'connected',
    'edge.delete': 'disconnected'
  };

  let open = $state(false);
  let changes = $state<AgentChange[]>([]);
  let busy = $state(false);
  let asking = $state<{ change: AgentChange; conflicts: EventConflict[]; picks: Record<string, Keep> } | null>(null);
  let confirming = $state<{ change: AgentChange; nodeId: string } | null>(null);
  let notice = $state<string | null>(null);

  const keyOf = (c: { eventId: number; path: string }) => `${c.eventId}:${c.path}`;
  const shown = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value) ?? 'empty');
  const describe = (change: AgentChange) =>
    change.writes.map((w) => `${VERB[w.kind]} ${w.edgeId ? 'a line' : nameOf(w.nodeId)}`).join(', ');

  async function reload() {
    changes = await load();
  }

  async function toggle() {
    open = !open;
    notice = null;
    if (open) {
      await reload();
    }
  }

  async function run(change: AgentChange, choices: Choice[] = [], confirm = false) {
    busy = true;
    notice = null;
    const result = await reject(change.eventIds, choices, confirm);
    busy = false;
    asking = null;
    confirming = null;
    if (!result) {
      notice = 'Reject failed: try again';
      return;
    }
    if (result.outcome === RejectOutcome.Conflict) {
      asking = { change, conflicts: result.conflicts, picks: Object.fromEntries(result.conflicts.map((c) => [keyOf(c), Keep.Mine])) };
      return;
    }
    if (result.outcome === RejectOutcome.Confirm) {
      confirming = { change, nodeId: result.nodeId };
      return;
    }
    if (result.outcome !== RejectOutcome.Rejected) {
      notice = 'The node changed meanwhile: try again';
      return;
    }
    notice = result.reverted.length ? 'Change rejected' : 'Nothing left to reject';
    await reload();
  }

  function resolve() {
    if (!asking) {
      return;
    }
    const picks = asking.picks;
    const choices = asking.conflicts.map((c) => ({ eventId: c.eventId, path: c.path, keep: picks[keyOf(c)] }));
    run(asking.change, choices);
  }
</script>

<div class="agent-changes" data-testid="agent-changes">
  <button type="button" class="toggle" aria-label={LABEL} aria-expanded={open} use:tip={{ name: LABEL, keys: '' }} onclick={toggle}>
    <Bot size={16} />
  </button>
  {#if open}
    <section aria-label={LABEL}>
      {#if asking}
        <p class="title">You edited these fields after the agent</p>
        {#each asking.conflicts as conflict (keyOf(conflict))}
          <div class="conflict" data-testid="reject-conflict">
            <span class="path">{nameOf(conflict.nodeId)} · {conflict.path.replace(/^data\./, '')}</span>
            <label><input type="radio" bind:group={asking.picks[keyOf(conflict)]} value={Keep.Mine} /> Keep mine: {shown(conflict.mine)}</label>
            <label><input type="radio" bind:group={asking.picks[keyOf(conflict)]} value={Keep.Reject} /> Take reject: {shown(conflict.original)}</label>
          </div>
        {/each}
        <div class="actions">
          <button type="button" onclick={() => (asking = null)}>Cancel</button>
          <button type="button" class="primary" disabled={busy} onclick={resolve}>Apply</button>
        </div>
      {:else if confirming}
        <p class="title">Someone else connected or edited {nameOf(confirming.nodeId)} since. Delete it anyway?</p>
        <div class="actions">
          <button type="button" onclick={() => (confirming = null)}>Keep it</button>
          <button type="button" class="primary" disabled={busy} onclick={() => run(confirming!.change, [], true)}>Delete</button>
        </div>
      {:else}
        {#if notice}<p class="notice" role="status">{notice}</p>{/if}
        <ol>
          {#each changes as change (change.eventIds.join())}
            <li>
              <span class="what">
                <span class="agent">{change.agent ?? 'agent'}</span>
                {describe(change)}
              </span>
              <button type="button" data-testid="reject-change" disabled={busy} onclick={() => run(change)}>Reject</button>
            </li>
          {:else}
            <li class="empty">No agent changes yet</li>
          {/each}
        </ol>
      {/if}
    </section>
  {/if}
</div>

<style>
  .agent-changes {
    position: relative;
    font-size: 12px;
    color: var(--ui-text);
  }

  button {
    font: inherit;
    height: 28px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-panel-raised);
    color: inherit;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
  }

  .toggle {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border-radius: var(--ui-radius-full);
    box-shadow: var(--ui-shadow-float);
    color: var(--ui-icon-ink);
  }
  .toggle:hover {
    color: var(--ui-text);
  }

  section {
    position: absolute;
    right: 0;
    bottom: calc(100% + 8px);
    width: min(320px, calc(100vw - 24px));
    max-height: min(320px, calc(100dvh - 140px));
    overflow-y: auto;
    padding: 6px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-panel-raised);
    box-shadow: var(--ui-shadow-float);
  }

  ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  li {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 8px;
    padding: 4px;
  }

  li button,
  .actions button {
    box-shadow: inset 0 0 0 1px var(--ui-border, rgba(127, 127, 127, 0.3));
  }

  .agent {
    font-weight: 600;
    margin-right: 4px;
  }

  .title,
  .notice {
    margin: 4px;
  }

  .conflict {
    display: grid;
    gap: 4px;
    padding: 6px 4px;
  }

  .path {
    font-weight: 600;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 6px;
    padding: 4px;
  }

  .primary {
    background: var(--ui-accent-solid);
    color: var(--ui-on-accent);
  }

  .empty {
    opacity: 0.6;
  }
</style>
