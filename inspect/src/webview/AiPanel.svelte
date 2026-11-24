<script lang="ts">
  import { AiState, ToHost, type HostMessage } from '../messages';
  import { ai, aiAnswered, aiCleared, aiSaid } from './ai-state.svelte';
  import { chipOf } from './ai-context';
  import { ItemKind } from './ai-transcript';
  import { lineDiff } from './ai-diff';
  import { markdown } from './ai-markdown';
  import { ToolStatus } from '../host/ai/agent-session';

  type Props = { context: string | null; tohost: (message: HostMessage) => void };

  let { context, tohost }: Props = $props();

  let text = $state('');
  let dropped = $state<string | null>(null);

  const chip = $derived(context !== null && dropped !== context ? chipOf(context) : null);
  const busy = $derived(ai.state === AiState.Busy);
  const ready = $derived(ai.state === AiState.Ready || busy);
  const current = $derived(ai.agents.find((a) => a.id === ai.agent));
  const available = $derived(ai.agents.filter((a) => a.installed));
  const missing = $derived(ai.agents.filter((a) => !a.installed));

  $effect(() => {
    tohost({ kind: ToHost.AiList });
  });

  function pick(id: string) {
    aiCleared();
    tohost({ kind: ToHost.AiStart, agent: id as never });
  }

  function send() {
    const question = text.trim();
    if (!question || !ready || busy) {
      return;
    }
    const attached = chip ? context : null;
    aiSaid(question, chip);
    tohost({ kind: ToHost.AiSend, text: question, context: attached });
    text = '';
  }

  function onkey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function answer(id: string, optionId: string | null, name: string) {
    aiAnswered(id, name);
    tohost({ kind: ToHost.AiAnswer, id, optionId });
  }

  const STATUS_MARK: Record<ToolStatus, string> = { [ToolStatus.Pending]: '…', [ToolStatus.Running]: '…', [ToolStatus.Done]: '✓', [ToolStatus.Failed]: '✕' };
</script>

<div class="ai" data-testid="ai-panel">
  <header>
    <select aria-label="Agent" data-testid="ai-agent" value={ai.agent ?? ''} onchange={(e) => pick(e.currentTarget.value)}>
      <option value="" disabled>Choose an agent</option>
      {#each available as agent (agent.id)}<option value={agent.id}>{agent.label}{agent.adapter ? ' (adapter)' : ''}</option>{/each}
    </select>
    <span class="state" data-testid="ai-state">{ai.state === AiState.Starting ? 'Starting…' : busy ? 'Working…' : ready ? 'Ready' : ''}</span>
  </header>

  {#if !available.length}
    <p class="empty">No coding agent found on this machine.</p>
  {/if}
  {#if missing.length}
    <details class="missing">
      <summary>Not installed ({missing.length})</summary>
      {#each missing as agent (agent.id)}<div class="hint"><b>{agent.label}</b> <code>{agent.install}</code></div>{/each}
    </details>
  {/if}

  <div class="thread" data-testid="ai-thread">
    {#each ai.items as item, i (i)}
      {#if item.kind === ItemKind.User}
        <div class="user">
          {#if item.context}<span class="chip">{item.context}</span>{/if}
          <p>{item.text}</p>
        </div>
      {:else if item.kind === ItemKind.Agent}
        <div class="agent">{@html markdown(item.text)}</div>
      {:else if item.kind === ItemKind.Thought}
        <details class="thought"><summary>Thinking</summary><div>{item.text}</div></details>
      {:else if item.kind === ItemKind.Tool}
        <div class="tool" data-status={item.tool.status}>
          <div class="tool-head"><span>{STATUS_MARK[item.tool.status]}</span><span>{item.tool.title}</span></div>
          {#each item.tool.diffs as diff (diff.path)}
            <div class="diff"><div class="path">{diff.path}</div>{#each lineDiff(diff.before, diff.after) as row, r (r)}<div class={`line ${row.kind}`}>{row.text || ' '}</div>{/each}</div>
          {/each}
        </div>
      {:else if item.kind === ItemKind.Plan}
        <ul class="plan">{#each item.entries as entry, e (e)}<li data-status={entry.status}>{entry.content}</li>{/each}</ul>
      {:else if item.kind === ItemKind.Permission}
        <div class="permission" data-testid="ai-permission">
          <div class="tool-head"><span>{item.tool.title}</span></div>
          {#each item.tool.diffs as diff (diff.path)}
            <div class="diff"><div class="path">{diff.path}</div>{#each lineDiff(diff.before, diff.after) as row, r (r)}<div class={`line ${row.kind}`}>{row.text || ' '}</div>{/each}</div>
          {/each}
          {#if item.answer}
            <span class="answer">{item.answer}</span>
          {:else}
            <div class="choices">{#each item.options as option (option.id)}<button type="button" class:allow={option.allows} data-testid="ai-option" onclick={() => answer(item.id, option.id, option.name)}>{option.name}</button>{/each}</div>
          {/if}
        </div>
      {:else if item.kind === ItemKind.Error}
        <p class="error">{item.text}</p>
      {:else}
        <p class="note">{item.text}</p>
      {/if}
    {/each}
  </div>

  <div class="composer">
    {#if chip}
      <span class="chip" data-testid="ai-chip">{chip}<button type="button" aria-label="Remove the selection from the message" onclick={() => (dropped = context)}>×</button></span>
    {/if}
    <textarea rows="3" placeholder={current ? `Ask ${current.label}` : 'Choose an agent first'} aria-label="Message" data-testid="ai-input" disabled={!ready} bind:value={text} onkeydown={onkey}></textarea>
    <div class="actions">
      {#if busy}
        <button type="button" data-testid="ai-cancel" onclick={() => tohost({ kind: ToHost.AiCancel })}>Stop</button>
      {:else}
        <button type="button" class="primary" data-testid="ai-send" disabled={!ready || !text.trim()} onclick={send}>Send</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .ai {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px 12px;
    font-size: var(--ui-text-sm);
    color: var(--ui-text);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  select,
  textarea {
    background: var(--ui-input);
    color: var(--ui-text);
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-sm);
    font: inherit;
    padding: 4px 6px;
  }

  textarea {
    width: 100%;
    resize: vertical;
    box-sizing: border-box;
  }

  .state,
  .note,
  .hint,
  .empty {
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
    margin: 0;
  }

  .thread {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .user {
    align-self: flex-end;
    max-width: 90%;
    background: var(--ui-input);
    border-radius: var(--ui-radius-md);
    padding: 6px 8px;
  }

  .user p,
  .error {
    margin: 0;
    white-space: pre-wrap;
  }

  .error {
    color: var(--ui-accent);
  }

  .agent :global(p),
  .agent :global(ul),
  .agent :global(h4) {
    margin: 0 0 6px;
  }

  .agent :global(pre) {
    background: var(--ui-input);
    border-radius: var(--ui-radius-sm);
    padding: 6px 8px;
    overflow-x: auto;
    margin: 0 0 6px;
  }

  .agent :global(code) {
    font-size: var(--ui-text-xs);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--ui-text-xs);
    color: var(--ui-text-2);
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-full);
    padding: 1px 8px;
    align-self: flex-start;
  }

  .chip button {
    all: unset;
    cursor: pointer;
    color: var(--ui-text-3);
  }

  .tool,
  .permission {
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-md);
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .tool-head {
    display: flex;
    gap: 6px;
    color: var(--ui-text-2);
  }

  .tool[data-status='failed'] .tool-head {
    color: var(--ui-accent);
  }

  .diff {
    font-family: ui-monospace, monospace;
    font-size: var(--ui-text-xs);
    border-radius: var(--ui-radius-sm);
    overflow: hidden;
    max-height: 200px;
    overflow-y: auto;
  }

  .path {
    color: var(--ui-text-3);
    padding-bottom: 2px;
  }

  .line {
    white-space: pre-wrap;
    padding: 0 4px;
  }

  .line.added {
    background: color-mix(in srgb, #2ea043 25%, transparent);
  }

  .line.removed {
    background: color-mix(in srgb, #f85149 25%, transparent);
  }

  .plan {
    margin: 0;
    padding-left: 16px;
  }

  .plan li[data-status='completed'] {
    color: var(--ui-text-3);
    text-decoration: line-through;
  }

  .choices,
  .actions {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
  }

  button {
    background: var(--ui-input);
    color: var(--ui-text);
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-sm);
    font: inherit;
    padding: 3px 10px;
    cursor: pointer;
  }

  button.allow,
  button.primary {
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
    border-color: transparent;
  }

  button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .composer {
    display: flex;
    flex-direction: column;
    gap: 6px;
    position: sticky;
    bottom: 0;
    background: var(--ui-panel);
    padding-top: 6px;
  }

  .thought {
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  code {
    font-family: ui-monospace, monospace;
  }
</style>
