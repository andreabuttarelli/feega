<script lang="ts">
  import { groupModels, type AgentModel } from '$lib/acp/agent-models';

  type Props = { models: AgentModel[]; selected: string | null; open?: boolean; onchoose: (id: string) => void };

  let { models, selected, open = $bindable(false), onchoose }: Props = $props();

  let query = $state('');
  let search = $state<HTMLInputElement | null>(null);

  $effect(() => {
    search?.focus();
  });

  const current = $derived(models.find((m) => m.id === selected) ?? null);
  const groups = $derived(groupModels(models, query));

  function choose(id: string) {
    onchoose(id);
    open = false;
    query = '';
  }

  function closeOnEscape(e: KeyboardEvent) {
    if (e.key !== 'Escape') {
      return;
    }

    open = false;
  }

  function chooseFirstOnEnter(e: KeyboardEvent) {
    const first = groups[0]?.models[0];
    if (e.key !== 'Enter' || !first) {
      return;
    }

    e.preventDefault();
    choose(first.id);
  }
</script>

{#if models.length > 0}
  <div class="model" onkeydown={closeOnEscape} role="presentation">
    <button type="button" class="trigger" aria-haspopup="listbox" aria-expanded={open} aria-label="Model" onclick={() => (open = !open)} data-testid="acp-model">
      <span class="value">{current?.name ?? selected}</span>
      <span class="caret" aria-hidden="true">▾</span>
    </button>

    {#if open}
      <div class="menu">
        <input class="search" type="search" placeholder="Search models" bind:value={query} onkeydown={chooseFirstOnEnter} bind:this={search} data-testid="acp-model-search" />
        <ul class="list" role="listbox" aria-label="Model">
          {#each groups as g (g.provider)}
            {#if g.provider}<li class="provider" role="presentation">{g.provider}</li>{/if}
            {#each g.models as m (m.id)}
              <li role="presentation">
                <button type="button" class="option" role="option" aria-selected={m.id === selected} title={m.description ?? undefined} data-model={m.id} onclick={() => choose(m.id)}>{m.name}</button>
              </li>
            {/each}
          {:else}
            <li class="empty" role="presentation">No model matches</li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
{/if}

<style>
  .model {
    flex: 0 1 50%;
    min-width: 0;
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

  .value {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    text-align: left;
  }

  .menu {
    position: absolute;
    z-index: 10;
    left: var(--ui-space-3);
    right: var(--ui-space-3);
    top: calc(100% - var(--ui-space-1));
    display: flex;
    flex-direction: column;
    max-height: min(480px, 70vh);
    padding: var(--ui-space-2);
    border-radius: var(--ui-radius-md);
    background: var(--ui-surface, var(--ui-input));
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.18), inset 0 0 0 1px var(--ui-divider);
  }

  .search {
    height: 28px;
    padding: 0 var(--ui-space-2);
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
  }

  .list {
    flex: 1;
    min-height: 0;
    overflow: auto;
    margin: var(--ui-space-2) 0 0;
    padding: 0;
    list-style: none;
  }

  .provider {
    padding: var(--ui-space-2) var(--ui-space-2) var(--ui-space-1);
    color: var(--ui-text-secondary);
    font-size: var(--ui-type-caption);
  }

  .option {
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

  .option:hover,
  .option[aria-selected='true'] {
    background: var(--ui-input);
  }

  .empty {
    padding: var(--ui-space-2);
    color: var(--ui-text-secondary);
  }
</style>
