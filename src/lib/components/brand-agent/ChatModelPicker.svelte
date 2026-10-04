<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { defaultEffortOf, shortLabel, type ChatModelChoice, type ChatModelGroup, type ChatModelOption } from '$lib/chat-model';

  let {
    groups,
    choice,
    onchoose
  }: {
    groups: ChatModelGroup[];
    choice: ChatModelChoice;
    onchoose: (next: ChatModelChoice) => void;
  } = $props();

  const chosen = $derived<ChatModelOption | undefined>(groups.flatMap((g) => g.options).find((o) => o.id === choice.model));
  const efforts = $derived(chosen?.efforts ?? []);

  const price = (o: ChatModelOption) => $_('chat.panel.price', { values: { input: o.inputUsdPerM.toFixed(2), output: o.outputUsdPerM.toFixed(2) } });

  function pickModel(id: string) {
    const option = groups.flatMap((g) => g.options).find((o) => o.id === id);
    if (option) {
      onchoose({ model: option.id, reasoning: defaultEffortOf(option) });
    }
  }
</script>

<div class="picker">
  <select
    name="model"
    class="pick model"
    aria-label={$_('chat.panel.model')}
    title={chosen ? price(chosen) : $_('chat.panel.model')}
    value={choice.model}
    onchange={(e) => pickModel(e.currentTarget.value)}
  >
    {#each groups as group (group.provider)}
      <optgroup label={group.provider}>
        {#each group.options as option (option.id)}
          <option value={option.id} selected={option.id === choice.model}>{shortLabel(option)} · {option.costTier}</option>
        {/each}
      </optgroup>
    {/each}
  </select>

  {#if efforts.length}
    <select
      name="reasoning"
      class="pick effort"
      aria-label={$_('chat.panel.reasoning')}
      title={$_('chat.panel.reasoning')}
      value={choice.reasoning ?? ''}
      onchange={(e) => onchoose({ model: choice.model, reasoning: e.currentTarget.value })}
    >
      {#each efforts as effort (effort)}
        <option value={effort} selected={effort === choice.reasoning}>{$_(`chat.panel.effort.${effort}`, { default: effort })}</option>
      {/each}
    </select>
  {/if}
</div>

<style>
  .picker {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .pick {
    min-width: 0;
    max-width: 100%;
    height: 26px;
    padding: 0 6px;
    border: 1px solid var(--line, #ededef);
    background: var(--paper-2, #f9f9f9);
    color: var(--ink-soft, #6e6e73);
    font: inherit;
    font-size: 11.5px;
    cursor: pointer;
    text-overflow: ellipsis;
  }
  .pick:hover {
    color: var(--ink, #1d1d1f);
  }
  .pick:focus-visible {
    outline: 2px solid var(--accent, #c485fe);
    outline-offset: 1px;
  }
  .model {
    flex: 1 1 auto;
    max-width: 200px;
  }
  .effort {
    flex: 0 0 auto;
  }
</style>
