<script lang="ts">
  import { Button, type ButtonVariant } from '$lib/components/ui/button';
  import { AcpChat, Line } from '$lib/acp/acp-chat.svelte';
  import { AgentChoices } from '$lib/acp/agent-choices.svelte';
  import { AgentModelChoice } from '$lib/acp/agent-model-choice.svelte';
  import AcpAgentPicker from './AcpAgentPicker.svelte';
  import AcpModelPicker from './AcpModelPicker.svelte';
  import ChatComposer from '$lib/components/brand-agent/ChatComposer.svelte';
  import ChatMessage from '$lib/components/brand-agent/ChatMessage.svelte';

  const CLOUD_HINT = 'Feega cloud chat spends credits and runs at feega.app: import this .feega file there, or pick an agent installed on this computer. It edits the canvas through Feega’s tools and asks before each one.';
  const OPTION_VARIANT: Record<string, ButtonVariant> = { allow_once: 'primary', allow_always: 'primary', reject_once: 'secondary', reject_always: 'secondary' };
  let { fetcher = fetch, hint = CLOUD_HINT }: { fetcher?: typeof fetch; hint?: string } = $props();

  const chat = new AcpChat(fetcher);
  const choices = new AgentChoices(fetcher);
  const model = new AgentModelChoice();

  let draft = $state('');

  const agent = $derived(choices.current);

  $effect(() => {
    void choices.load();
  });

  $effect(() => {
    void model.load(choices.chosen);
  });

  const lastLine = $derived(chat.lines.at(-1));
  const awaiting = $derived(chat.busy && lastLine?.line === Line.User);

  function send() {
    const prompt = draft.trim();
    if (!agent || !prompt || chat.busy) {
      return;
    }

    draft = '';
    void chat.send(agent.id, prompt);
  }

  function startsRun(i: number) {
    return chat.lines[i - 1]?.line !== Line.Agent;
  }

  function isLive(i: number) {
    return chat.busy && i === chat.lines.length - 1;
  }
</script>

<section class="acp" data-testid="acp-chat">
  <AcpAgentPicker agents={choices.agents} chosen={choices.chosen} refreshing={choices.refreshing} onchoose={(id) => void choices.choose(id)} onrefresh={() => void Promise.all([choices.refresh(), model.refresh()])} />

  <ol class="lines">
    {#if !agent}
      <li class="hint">{hint}</li>
    {/if}
    {#each chat.lines as l, i (i)}
      {#if l.line === Line.User}
        <li><ChatMessage role="user" content={l.text} projectId="" /></li>
      {:else if l.line === Line.Agent}
        <li><ChatMessage role="assistant" content={l.text} projectId="" first={startsRun(i)} live={isLive(i)} /></li>
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
    {#if awaiting}
      <li><ChatMessage role="assistant" content="" projectId="" pending live /></li>
    {/if}
  </ol>

  <div class="dock">
    <ChatComposer bind:value={draft} busy={chat.busy} enabled={!!agent} placeholder={agent ? `Ask ${agent.name}` : 'Pick an agent first'} onsend={send} onstop={() => chat.stop()}>
      {#snippet controls()}
        <span class="model-slot" data-testid="acp-model-slot">
          <AcpModelPicker models={model.models} selected={model.selected} onchoose={(id) => void model.choose(id)} />
        </span>
      {/snippet}
    </ChatComposer>
  </div>
</section>

<style>
  .acp {
    display: flex;
    flex-direction: column;
    min-height: 0;
    font-size: var(--ui-type-body);
    font-family: 'DM Sans', var(--font-sans, system-ui), sans-serif;
    --chat-font: 14px;
    --chat-action: 32px;
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

  .hint,
  .tool,
  .error {
    white-space: pre-wrap;
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

  .dock {
    flex: 0 0 auto;
    padding: 0 var(--ui-space-3) var(--ui-space-3);
  }
</style>
