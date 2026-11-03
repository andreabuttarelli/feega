<script lang="ts">
  import type { CanvasPeer } from '$lib/realtime/canvas-presence';
  import { AgentShape, agentAvatar } from '$lib/realtime/agent-presence';

  let { agents }: { agents: CanvasPeer[] } = $props();

  const SHAPE_PATHS: Record<AgentShape, string> = {
    [AgentShape.Circle]: 'M14 1a13 13 0 1 1 0 26a13 13 0 1 1 0-26Z',
    [AgentShape.Square]: 'M7 1h14a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6H7a6 6 0 0 1-6-6V7a6 6 0 0 1 6-6Z',
    [AgentShape.Hexagon]: 'M14 1l11.3 6.5v13L14 27L2.7 20.5v-13Z',
    [AgentShape.Diamond]: 'M14 0.5l13.5 13.5L14 27.5L0.5 14Z',
    [AgentShape.Blob]: 'M14 1c6 0 12 3 12 11s-3 15-12 15S2 21 2 13S8 1 14 1Z'
  };

  const SPARKLE = 'M5 0l1.2 3.8L10 5L6.2 6.2L5 10L3.8 6.2L0 5L3.8 3.8Z';
</script>

{#if agents.length}
  <ul class="agents" aria-label="Agents on this canvas" data-testid="agent-avatars">
    {#each agents as agent (agent.sessionId)}
      {@const avatar = agentAvatar(agent.sessionId, agent.name)}
      {@const label = `${agent.name} — ${agent.agent?.doing ?? 'working'}`}
      <li class="agent" data-testid="agent-avatar" title={label} aria-label={label}>
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
          <path d={SHAPE_PATHS[avatar.shape]} fill={avatar.colour} stroke="var(--ui-surface, #fff)" stroke-width="2" />
          <text x="14" y="18.5" text-anchor="middle" fill="#fff" font-size="12" font-weight="600">{avatar.initial}</text>
        </svg>
        <span class="badge" data-testid="agent-badge">
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d={SPARKLE} fill={avatar.colour} /></svg>
        </span>
      </li>
    {/each}
  </ul>
{/if}

<style>
  .agents {
    display: flex;
    align-items: center;
    margin: 0 0 0 4px;
    padding: 0;
    list-style: none;
  }

  .agent {
    position: relative;
    width: 28px;
    height: 28px;
    margin-left: -4px;
    cursor: default;
  }

  .agent svg {
    display: block;
  }

  .badge {
    position: absolute;
    right: -3px;
    bottom: -3px;
    display: grid;
    place-items: center;
    width: 14px;
    height: 14px;
    border-radius: 9999px;
    background: var(--ui-surface, #fff);
    box-shadow: 0 0 0 1px var(--ui-border, rgb(0 0 0 / 0.1));
  }
</style>
