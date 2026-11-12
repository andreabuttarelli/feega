<script lang="ts">
  import { Button, type ButtonVariant } from '$lib/components/ui/button';
  import { AcpChat, Line } from '$lib/acp/acp-chat.svelte';
  import { ACP_AGENT_LABELS, AcpAgent, isAcpAgent, readAcpAgent, writeAcpAgent } from '$lib/acp/agent-choices';

  const NO_AGENT = '';
  const OPTION_VARIANT: Record<string, ButtonVariant> = { allow_once: 'primary', allow_always: 'primary', reject_once: 'secondary', reject_always: 'secondary' };
  const chat = new AcpChat();

  let agent = $state<AcpAgent | null>(readAcpAgent());
  let draft = $state('');

  function pickAgent(e: Event) {
    const value = (e.currentTarget as HTMLSelectElement).value;
    agent = isAcpAgent(value) ? value : null;
    writeAcpAgent(agent);
  }

  function submit(e: Event) {
    e.preventDefault();
    const prompt = draft.trim();
    if (!agent || !prompt || chat.busy) {
      return;
    }

    draft = '';
    void chat.send(agent, prompt);
  }

  function sendOnEnter(e: KeyboardEvent) {
    if (e.key !== 'Enter' || e.shiftKey) {
      return;
    }

    submit(e);
  }
</script>

<section class="acp" data-testid="acp-chat">
  <label class="picker">
    <span>Agent</span>
    <select value={agent ?? NO_AGENT} onchange={pickAgent} data-testid="acp-agent-picker">
      <option value={NO_AGENT}>None</option>
      {#each Object.values(AcpAgent) as each (each)}
        <option value={each}>{ACP_AGENT_LABELS[each]}</option>
      {/each}
    </select>
  </label>

  <ol class="lines">
    {#if !agent}
      <li class="hint">Pick an agent installed on this computer. It edits the canvas through Feega's tools and asks before each one.</li>
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
      {:else}
        <li class="permission" data-testid="acp-permission">
          <p>{agent ? ACP_AGENT_LABELS[agent] : 'The agent'} wants to run <strong>{l.title}</strong></p>
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
    <textarea bind:value={draft} onkeydown={sendOnEnter} rows="2" placeholder={agent ? `Ask ${ACP_AGENT_LABELS[agent]}` : 'Pick an agent first'} disabled={!agent} data-testid="acp-input"></textarea>
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

  .picker {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    padding: var(--ui-space-2) var(--ui-space-3);
    border-bottom: 1px solid var(--ui-divider);
    color: var(--ui-text-secondary);
  }

  .picker select {
    flex: 1;
    height: 28px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
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
