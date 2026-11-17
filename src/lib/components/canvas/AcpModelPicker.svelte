<script lang="ts">
  import type { AgentModel } from '$lib/acp/agent-models';

  type Props = { models: AgentModel[]; selected: string | null; onchoose: (id: string) => void };

  let { models, selected, onchoose }: Props = $props();
</script>

{#if models.length > 0}
  <label class="model">
    <select aria-label="Model" value={selected} onchange={(e) => onchoose(e.currentTarget.value)} data-testid="acp-model">
      {#each models as m (m.id)}
        <option value={m.id} selected={m.id === selected} title={m.description ?? undefined}>{m.name}</option>
      {/each}
    </select>
  </label>
{/if}

<style>
  .model {
    display: flex;
    align-items: center;
    flex: 0 1 50%;
    min-width: 0;
    height: 24px;
    padding: 0 var(--ui-space-2);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
  }

  select {
    width: 100%;
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--ui-text);
    font: inherit;
    cursor: pointer;
  }
</style>
