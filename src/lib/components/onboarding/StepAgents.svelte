<script lang="ts" module>
  import { AgentStatus } from '$lib/acp/agent-status';
  import type { DetectedAgent } from '$lib/acp/detected-agent';

  type Hint = { note: string; command: (agent: DetectedAgent) => string | null };

  const HINTS: Readonly<Record<AgentStatus, Hint>> = {
    [AgentStatus.Ready]: { note: 'ready', command: () => null },
    [AgentStatus.SignInUnknown]: { note: 'ready', command: () => null },
    [AgentStatus.NeedsLogin]: { note: 'not signed in', command: (agent) => agent.login },
    [AgentStatus.NoAcp]: { note: 'needs npx to connect', command: () => null },
    [AgentStatus.NotInstalled]: { note: 'not installed', command: (agent) => agent.install }
  };

  const SUGGESTED = 3;
</script>

<script lang="ts">
  import { AGENT_STATUS, readyFirst, statusOf } from '$lib/acp/agent-status';
  import { markOf } from '$lib/acp/agent-marks';

  type Props = { agents: DetectedAgent[]; chosen: string | null; refreshing: boolean; onchoose: (id: string) => void; onrefresh: () => void; oncontinue: () => void };

  let { agents, chosen, refreshing, onchoose, onrefresh, oncontinue }: Props = $props();

  const ordered = $derived(readyFirst(agents));
  const found = $derived(ordered.filter((agent) => agent.installed));
  const listed = $derived(found.length ? found : ordered.slice(0, SUGGESTED));
</script>

<h1 id="ob-title" class="ob-title">{found.length ? 'your AI assistants are already here.' : 'bring an AI assistant.'}</h1>
<p class="ob-sub">
  {found.length
    ? 'feega found these AI coding assistants on this computer. pick one: you ask in the chat, it designs on the canvas. it uses the plan you already have with it, feega adds no cost. no assistant? skip and design by hand.'
    : 'feega works with AI coding assistants like Claude Code. none is installed here yet. install one, or skip and design by hand.'}
</p>

<ul class="agents" data-testid="onboarding-agents">
  {#each listed as agent (agent.id)}
    {@const status = statusOf(agent)}
    {@const hint = HINTS[status]}
    {@const command = hint.command(agent)}
    {@const mark = markOf(agent.id)}
    <li>
      <button type="button" class="agent" class:chosen={chosen === agent.id} disabled={!AGENT_STATUS[status].usable} aria-pressed={chosen === agent.id} onclick={() => onchoose(agent.id)} data-agent={agent.id}>
        {#if mark}
          <svg class="mark" viewBox={mark.viewBox} fill="currentColor" fill-rule={mark.evenodd ? 'evenodd' : 'nonzero'} aria-hidden="true">
            {#each mark.paths as d (d)}<path {d} />{/each}
          </svg>
        {:else}
          <span class="mark monogram" aria-hidden="true">{agent.name.slice(0, 1)}</span>
        {/if}
        <span class="name">{agent.name}</span>
        <span class="note" class:ready={AGENT_STATUS[status].rank === 0}>{hint.note}</span>
      </button>
      {#if command}<code><span>in a terminal:</span> {command}</code>{/if}
    </li>
  {/each}
</ul>

<button type="button" class="ob-primary" onclick={oncontinue} data-testid="onboarding-continue">continue</button>
<button type="button" class="ob-link" disabled={refreshing} onclick={onrefresh} data-testid="onboarding-detect">{refreshing ? 'looking…' : 'detect again'}</button>

<style>
  .agents {
    display: grid;
    gap: 4px;
    margin: 0 0 16px;
    padding: 0;
    list-style: none;
    max-height: 44vh;
    overflow: auto;
  }

  .agent {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 48px;
    padding: 0 14px;
    border: 0;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
    transition: box-shadow 200ms var(--ui-ease);
  }

  .agent:disabled {
    cursor: default;
    color: var(--ui-text-secondary);
  }

  .agent.chosen {
    background: var(--ui-wash);
    box-shadow: inset 0 0 0 1.5px var(--ui-text);
  }

  .agent:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }

  .mark {
    width: 20px;
    height: 20px;
    flex: none;
  }

  .monogram {
    display: grid;
    place-items: center;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-divider);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .name {
    flex: 1;
    font-weight: 500;
  }

  .note {
    font-size: 12px;
    color: var(--ui-text-secondary);
  }

  .note.ready {
    color: var(--ui-text);
  }

  .note.ready::before {
    content: '';
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-right: 6px;
    border-radius: var(--ui-radius-full);
    background: #2fbf71;
    vertical-align: 1px;
  }

  code {
    display: block;
    margin: 4px 0 6px;
    padding: 8px 14px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
    font-family: var(--ui-mono);
    font-size: 11px;
    color: var(--ui-text-secondary);
    overflow-x: auto;
    white-space: nowrap;
    user-select: all;
  }

  code span {
    font-family: var(--ui-sans);
    user-select: none;
  }
</style>
