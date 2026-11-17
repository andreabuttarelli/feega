<script lang="ts">
  import { Button, type ButtonVariant } from '$lib/components/ui/button';
  import { AcpChat, Line } from '$lib/acp/acp-chat.svelte';
  import { AgentChoices } from '$lib/acp/agent-choices.svelte';
  import { AgentModelChoice } from '$lib/acp/agent-model-choice.svelte';
  import AcpAgentPicker from './AcpAgentPicker.svelte';
  import AcpModelPicker from './AcpModelPicker.svelte';

  const CLOUD_HINT = 'Feega cloud chat spends credits and runs at feega.app: import this .feega file there, or pick an agent installed on this computer. It edits the canvas through Feega’s tools and asks before each one.';
  const OPTION_VARIANT: Record<string, ButtonVariant> = { allow_once: 'primary', allow_always: 'primary', reject_once: 'secondary', reject_always: 'secondary' };
  const chat = new AcpChat();
  const choices = new AgentChoices();
  const model = new AgentModelChoice();

  let draft = $state('');

  const agent = $derived(choices.current);

  $effect(() => {
    void choices.load();
  });

  $effect(() => {
    void model.load(choices.chosen);
  });

  function submit(e: Event) {
    e.preventDefault();
    const prompt = draft.trim();
    if (!agent || !prompt || chat.busy) {
      return;
    }

    draft = '';
    void chat.send(agent.id, prompt);
  }

  function sendOnEnter(e: KeyboardEvent) {
    if (e.key !== 'Enter' || e.shiftKey) {
      return;
    }

    submit(e);
  }
</script>

<section class="acp" data-testid="acp-chat">
  <AcpAgentPicker agents={choices.agents} chosen={choices.chosen} refreshing={choices.refreshing} onchoose={(id) => void choices.choose(id)} onrefresh={() => void Promise.all([choices.refresh(), model.refresh()])}>
    {#snippet beside()}
      <AcpModelPicker models={model.models} selected={model.selected} onchoose={(id) => void model.choose(id)} />
    {/snippet}
  </AcpAgentPicker>

  <ol class="lines">
    {#if !agent}
      <li class="hint">{CLOUD_HINT}</li>
    {/if}
    {#each chat.lines as l, i (i)}
      {#if l.line === Line.User}
        <li class="user">{l.text}</li>
      {:else if l.line === Line.Agent}
        <li class="agent">{l.text}</li>
      {:else if l.line === Line.Tool}
        <li class="tool">{l.title}</li>
      {:else if l.line === Line.Error}
        <li class="error" role="alert">{l.text}</li>
      {:else if l.line === Line.Permission}
        <li class="permission" data-testid="acp-permission">
          <p>{agent?.name ?? 'The agent'} wants to run <strong>{l.title}</strong></p>
          <div class="options">
            {#each l.options as o (o.optionId)}
              <Button size="sm" variant={OPTION_VARIANT[o.kind] ?? 'secondary'} disabled={l.chosen !== null} aria-pressed={l.chosen === o.optionId} onclick={() => chat.answer(l.id, o.optionId)}>{o.name}</Button>
            {/each}
          </div>
        </li>
      {/if}
    {/each}
  </ol>

  <form class="composer" onsubmit={submit}>
    <textarea bind:value={draft} onkeydown={sendOnEnter} rows="2" placeholder={agent ? `Ask ${agent.name}` : 'Pick an agent first'} disabled={!agent} data-testid="acp-input"></textarea>
    <Button size="sm" type="submit" disabled={!agent || chat.busy || !draft.trim()}>Send</Button>
  </form>
</section>

<style>
  .acp {
    display: flex;
    flex-direction: column;
    min-height: 0;
    font-size: var(--ui-type-body);
  }

  .lines {
    flex: 1;
    min-height: 0;
    overflow: auto;
    margin: 0;
    padding: var(--ui-space-3);
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
  }

  .lines li {
    white-space: pre-wrap;
  }

  .user {
    align-self: flex-end;
    max-width: 85%;
    padding: var(--ui-space-2) var(--ui-space-3);
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
  }

  .hint,
  .tool {
    color: var(--ui-text-secondary);
    font-size: var(--ui-type-caption);
  }

  .error {
    color: var(--ui-danger);
  }

  .permission {
    padding: var(--ui-space-3);
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-md);
  }

  .permission p {
    margin: 0 0 var(--ui-space-2);
  }

  .options {
    display: flex;
    gap: var(--ui-space-2);
  }

  .composer {
    display: flex;
    gap: var(--ui-space-2);
    align-items: flex-end;
    padding: var(--ui-space-3);
    border-top: 1px solid var(--ui-divider);
  }

  .composer textarea {
    flex: 1;
    resize: none;
    padding: var(--ui-space-2);
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
  }
</style>
