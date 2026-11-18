<script lang="ts">
  import { _ } from 'svelte-i18n';
  import ChatEffortPicker from './ChatEffortPicker.svelte';
  import './chat-pick.css';
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
    class="chat-pick model"
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

  <ChatEffortPicker {efforts} value={choice.reasoning} onchoose={(reasoning) => onchoose({ model: choice.model, reasoning })} />
</div>

<style>
  .picker {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .model {
    flex: 1 1 auto;
    max-width: 200px;
  }
</style>
