<script lang="ts">
  import { Popover } from 'bits-ui';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import Check from '@lucide/svelte/icons/check';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Heading1 from '@lucide/svelte/icons/heading-1';
  import ImageIcon from '@lucide/svelte/icons/image';
  import Layers from '@lucide/svelte/icons/layers';
  import LinkIcon from '@lucide/svelte/icons/link';
  import List from '@lucide/svelte/icons/list';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import MousePointerClick from '@lucide/svelte/icons/mouse-pointer-click';
  import ShieldQuestion from '@lucide/svelte/icons/shield-question';
  import Square from '@lucide/svelte/icons/square';
  import Type from '@lucide/svelte/icons/type';
  import ShieldCheck from '@lucide/svelte/icons/shield-check';
  import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
  import X from '@lucide/svelte/icons/x';
  import { AiState, ToHost, type HostMessage } from '../messages';
  import { ai, aiAnswered, aiCleared, aiSaid } from './ai-state.svelte';
  import { ChipIcon, chipView } from './ai-chip';
  import { sendsOnKey } from './ai-keys';
  import { SUGGESTIONS, isDanger, isThinking, markOf, pickerLabel, placeholderOf, statusOf } from './ai-view';
  import { POLICY_ROWS, type Policy } from '../host/ai/permission-policy';
  import { ItemKind } from './ai-transcript';
  import { lineDiff } from './ai-diff';
  import { markdown } from './ai-markdown';
  import { ToolStatus } from '../host/ai/agent-session';

  type Props = { context: string | null; tohost: (message: HostMessage) => void };

  const COMPOSER_MAX_PX = 160;
  const CHIP_ICONS = { [ChipIcon.Heading]: Heading1, [ChipIcon.Text]: Type, [ChipIcon.Button]: MousePointerClick, [ChipIcon.Link]: LinkIcon, [ChipIcon.Image]: ImageIcon, [ChipIcon.List]: List, [ChipIcon.Box]: Square, [ChipIcon.Many]: Layers };

  let { context, tohost }: Props = $props();

  let text = $state('');
  let dropped = $state<string | null>(null);
  let menu = $state(false);
  let input = $state<HTMLTextAreaElement>();
  let permissions = $state(false);

  const chip = $derived(context !== null && dropped !== context ? chipView(context) : null);
  const busy = $derived(ai.state === AiState.Busy);
  const ready = $derived(ai.state === AiState.Ready || busy);
  const current = $derived(ai.agents.find((a) => a.id === ai.agent));
  const available = $derived(ai.agents.filter((a) => a.installed));
  const missing = $derived(ai.agents.filter((a) => !a.installed));
  const status = $derived(statusOf(ai.state));
  const mark = $derived(current ? markOf(current.id, current.label) : null);
  const thinking = $derived(isThinking(busy, ai.items));
  const danger = $derived(isDanger(ai.policy));

  $effect(() => {
    tohost({ kind: ToHost.AiList });
  });

  $effect(() => {
    void text;
    if (!input) {
      return;
    }
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, COMPOSER_MAX_PX)}px`;
  });

  function pick(id: string) {
    menu = false;
    if (id === ai.agent) {
      return;
    }
    aiCleared();
    tohost({ kind: ToHost.AiStart, agent: id as never });
  }

  function send() {
    const question = text.trim();
    if (!question || !ready || busy) {
      return;
    }
    aiSaid(question, chip ? context : null);
    tohost({ kind: ToHost.AiSend, text: question, context: chip ? context : null });
    text = '';
  }

  function suggest(suggestion: string) {
    text = suggestion;
    input?.focus();
  }

  function setPolicy(policy: Policy) {
    tohost({ kind: ToHost.AiPolicy, policy });
    permissions = false;
  }

  function setMode(id: string) {
    tohost({ kind: ToHost.AiMode, id });
    permissions = false;
  }

  function onkey(e: KeyboardEvent) {
    if (sendsOnKey(e)) {
      e.preventDefault();
      send();
    }
  }

  function answer(id: string, optionId: string | null, name: string) {
    aiAnswered(id, name);
    tohost({ kind: ToHost.AiAnswer, id, optionId });
  }
</script>

{#snippet glyph(id: string, label: string, size: number)}
  {@const m = markOf(id, label)}
  {#if m.logo}
    <svg class="glyph" width={size} height={size} viewBox={m.logo.viewBox} fill="currentColor" aria-hidden="true"><path d={m.logo.path} /></svg>
  {:else}
    <span class="glyph initial" style:width="{size}px" style:height="{size}px" style:font-size="{size * 0.6}px" aria-hidden="true">{m.initial}</span>
  {/if}
{/snippet}

{#snippet chipBody(view: NonNullable<typeof chip>)}
  {@const Icon = CHIP_ICONS[view.icon]}
  <Icon size={12} />
  <span class="chip-name">{view.name}</span>
  {#if view.place}<span class="chip-place">{view.place}</span>{/if}
{/snippet}

{#snippet diffs(list: { path: string; before: string | null; after: string }[])}
  {#each list as diff (diff.path)}
    <div class="diff"><div class="path">{diff.path}</div>{#each lineDiff(diff.before, diff.after) as row, r (r)}<div class={`line ${row.kind}`}>{row.text || ' '}</div>{/each}</div>
  {/each}
{/snippet}

<div class="ai" data-testid="ai-panel">
  <header>
    <Popover.Root bind:open={menu}>
      <Popover.Trigger class="agent-trigger" data-testid="ai-agent" aria-label="Agent">
        {#if current}{@render glyph(current.id, current.label, 14)}{/if}
        <span class="agent-name">{current ? current.label : 'Choose an agent'}</span>
        <span class="dot {status.dot}" title={status.label} data-testid="ai-state" aria-label={status.label}></span>
        <ChevronDown size={12} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content class="agent-menu" align="start" sideOffset={4} data-testid="ai-agent-menu">
          {#each available as agent (agent.id)}
            <button type="button" class="agent-option" data-testid="ai-agent-option" data-agent={agent.id} onclick={() => pick(agent.id)}>
              {@render glyph(agent.id, agent.label, 14)}
              <span class="agent-name">{agent.label}{agent.adapter ? ' (adapter)' : ''}</span>
              {#if agent.id === ai.agent}<span class="dot {status.dot}"></span>{/if}
            </button>
          {/each}
          {#if !available.length}<p class="menu-note">No coding agent found on this machine.</p>{/if}
          {#if missing.length}
            <p class="menu-label">Not installed ({missing.length})</p>
            {#each missing as agent (agent.id)}
              <div class="agent-option off" data-testid="ai-agent-missing">
                {@render glyph(agent.id, agent.label, 14)}
                <span class="agent-name">{agent.label}</span>
                <code class="install" title={agent.install}>Install</code>
              </div>
            {/each}
          {/if}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  </header>

  <div class="thread" data-testid="ai-thread">
    {#if !ai.items.length}
      <div class="empty" data-testid="ai-empty">
        {#if current}<span class="empty-mark">{@render glyph(current.id, current.label, 20)}</span>{/if}
        <p>{current ? `Ask ${current.label} to change what you selected.` : 'Pick an agent to start.'}</p>
        {#if ready}
          <div class="suggestions">{#each SUGGESTIONS as suggestion (suggestion)}<button type="button" class="suggestion" data-testid="ai-suggestion" onclick={() => suggest(suggestion)}>{suggestion}</button>{/each}</div>
        {/if}
      </div>
    {/if}
    {#each ai.items as item, i (i)}
      {#if item.kind === ItemKind.User}
        {@const view = chipView(item.context)}
        <div class="user">
          {#if view}<span class="chip static" title={view.title}>{@render chipBody(view)}</span>{/if}
          <p>{item.text}</p>
        </div>
      {:else if item.kind === ItemKind.Agent}
        <div class="reply">
          <span class="reply-mark">{#if current}{@render glyph(current.id, current.label, 14)}{/if}</span>
          <div class="agent">{@html markdown(item.text)}</div>
        </div>
      {:else if item.kind === ItemKind.Thought}
        <details class="thought"><summary>Thinking</summary><div>{item.text}</div></details>
      {:else if item.kind === ItemKind.Tool}
        <details class="tool" data-status={item.tool.status} data-testid="ai-tool">
          <summary>
            <span class="tool-status">
              {#if item.tool.status === ToolStatus.Done}<Check size={12} />{:else if item.tool.status === ToolStatus.Failed}<X size={12} />{:else}<span class="spin"><LoaderCircle size={12} /></span>{/if}
            </span>
            <span class="tool-title">{item.tool.title}</span>
            <ChevronRight class="tool-caret" size={12} />
          </summary>
          {@render diffs(item.tool.diffs)}
        </details>
      {:else if item.kind === ItemKind.Plan}
        <ul class="plan">{#each item.entries as entry, e (e)}<li data-status={entry.status}>{entry.content}</li>{/each}</ul>
      {:else if item.kind === ItemKind.Permission}
        <div class="permission" data-testid="ai-permission">
          <div class="permission-head"><ShieldQuestion size={14} /><span>{item.tool.title}</span></div>
          {@render diffs(item.tool.diffs)}
          {#if item.answer}
            <span class="answer">{item.answer}</span>
          {:else}
            <div class="choices">{#each [...item.options].sort((a, b) => Number(a.allows) - Number(b.allows)) as option (option.id)}<button type="button" class:allow={option.allows} data-testid="ai-option" onclick={() => answer(item.id, option.id, option.name)}>{option.name}</button>{/each}</div>
          {/if}
        </div>
      {:else if item.kind === ItemKind.Error}
        <p class="error">{item.text}</p>
      {:else}
        <p class="note">{item.text}</p>
      {/if}
    {/each}
    {#if thinking}<div class="thinking" data-testid="ai-thinking" aria-label="Thinking"><span></span><span></span><span></span></div>{/if}
  </div>

  <div class="composer">
    {#if chip}
      <span class="chip" data-testid="ai-chip" title={chip.title}>{@render chipBody(chip)}<button type="button" aria-label="Remove the selection from the message" onclick={() => (dropped = context)}><X size={11} /></button></span>
    {/if}
    <textarea rows="1" placeholder={placeholderOf(current?.label ?? null)} aria-label="Message" data-testid="ai-input" disabled={!ready} bind:this={input} bind:value={text} onkeydown={onkey}></textarea>
    <div class="send">
      <Popover.Root bind:open={permissions}>
        <Popover.Trigger class="perm-trigger {danger ? 'danger' : ''}" data-testid="ai-permissions" aria-label="Permissions">
          {#if danger}<TriangleAlert size={12} />{:else}<ShieldCheck size={12} />{/if}
          <span>{pickerLabel(ai.modes, ai.mode, ai.policy)}</span>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content class="agent-menu" align="start" side="top" sideOffset={4} data-testid="ai-permissions-menu">
            {#if ai.modes.length}
              <p class="menu-label">{current?.label ?? 'Agent'} mode</p>
              {#each ai.modes as mode (mode.id)}
                <button type="button" class="agent-option stacked" data-testid="ai-mode-option" data-mode={mode.id} onclick={() => setMode(mode.id)}>
                  <span class="check">{#if mode.id === ai.mode}<Check size={12} />{/if}</span>
                  <span class="stack"><span>{mode.name}</span>{#if mode.description}<span class="hint">{mode.description}</span>{/if}</span>
                </button>
              {/each}
            {/if}
            <p class="menu-label">Feega approvals</p>
            {#each POLICY_ROWS as row (row.id)}
              <button type="button" class="agent-option stacked" class:danger={row.danger} data-testid="ai-policy-option" data-policy={row.id} onclick={() => setPolicy(row.id)}>
                <span class="check">{#if row.id === ai.policy}<Check size={12} />{/if}</span>
                <span class="stack"><span>{row.name}</span><span class="hint">{row.hint}</span></span>
              </button>
            {/each}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {#if busy}
        <button type="button" class="round" aria-label="Stop" data-testid="ai-cancel" onclick={() => tohost({ kind: ToHost.AiCancel })}><Square size={10} fill="currentColor" /></button>
      {:else}
        <button type="button" class="round primary" aria-label="Send" data-testid="ai-send" disabled={!ready || !text.trim()} onclick={send}><ArrowUp size={14} /></button>
      {/if}
    </div>
  </div>
</div>

<style>
  .ai {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 8px 12px;
    font-size: var(--ui-text-sm);
    color: var(--ui-text);
  }

  header {
    display: flex;
    align-items: center;
  }

  :global(.agent-trigger) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: var(--ui-hit);
    padding: 0 6px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text);
    font: inherit;
    cursor: pointer;
  }

  :global(.agent-trigger:hover),
  :global(.agent-trigger[data-state='open']) {
    background: var(--ui-input-hover);
  }

  :global(.agent-trigger:focus-visible) {
    outline: 1px solid var(--ui-accent);
  }

  :global(.agent-menu) {
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 220px;
    max-width: 280px;
    padding: 4px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-panel);
    box-shadow: 0 0 0 1px var(--ui-divider), 0 12px 32px rgb(0 0 0 / 0.28);
    color: var(--ui-text);
    font-size: var(--ui-text-sm);
  }

  .agent-option {
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--ui-hit);
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  button.agent-option:hover {
    background: var(--ui-input-hover);
  }

  .agent-option.off {
    opacity: 0.55;
    cursor: default;
  }

  .agent-name {
    flex: 1;
    text-align: left;
    white-space: nowrap;
  }

  .install {
    font-family: inherit;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }

  .menu-label,
  .menu-note {
    margin: 4px 8px 2px;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  .glyph {
    flex: none;
  }

  .initial {
    display: inline-grid;
    place-items: center;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text-2);
    font-weight: 600;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: var(--ui-radius-full);
    flex: none;
  }

  .grey {
    background: #8e8e93;
  }

  .amber {
    background: #ff9f0a;
  }

  .green {
    background: #30d158;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 32px 8px 16px;
    color: var(--ui-text-2);
    text-align: center;
  }

  .empty p {
    margin: 0;
  }

  .empty-mark {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .suggestions {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
    width: 100%;
    margin-top: 8px;
  }

  .suggestion {
    padding: 6px 10px;
    border: 1px solid var(--ui-field-border);
    border-radius: var(--ui-radius-md);
    background: none;
    color: var(--ui-text-2);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .suggestion:hover {
    border-color: var(--ui-field-border-hover);
    background: var(--ui-input-hover);
    color: var(--ui-text);
  }

  .note,
  .install {
    margin: 0;
  }

  .note {
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  .thread {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .user {
    align-self: flex-end;
    display: flex;
    flex-direction: column;
    gap: 4px;
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
    color: #ff453a;
  }

  .reply {
    display: grid;
    grid-template-columns: 14px 1fr;
    gap: 8px;
  }

  .reply-mark {
    padding-top: 2px;
    color: var(--ui-text-2);
  }

  .agent {
    min-width: 0;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .agent :global(p),
  .agent :global(ul),
  .agent :global(h4) {
    margin: 0 0 8px;
  }

  .agent :global(:last-child) {
    margin-bottom: 0;
  }

  .agent :global(h4) {
    font-size: var(--ui-text-md);
    font-weight: 600;
  }

  .agent :global(ul) {
    padding-left: 18px;
  }

  .agent :global(a) {
    color: var(--ui-accent);
  }

  .agent :global(pre) {
    background: var(--ui-input);
    border-radius: var(--ui-radius-sm);
    padding: 8px;
    overflow-x: auto;
    margin: 0 0 8px;
  }

  .agent :global(code) {
    font-family: var(--ui-mono, ui-monospace, monospace);
    font-size: var(--ui-text-xs);
  }

  .agent :global(p code),
  .agent :global(li code) {
    padding: 1px 4px;
    border-radius: var(--ui-radius-xs);
    background: var(--ui-input);
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    align-self: flex-start;
    height: 20px;
    padding: 0 6px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }

  .chip.static {
    background: color-mix(in srgb, var(--ui-text) 8%, transparent);
  }

  .chip-name {
    color: var(--ui-text);
    white-space: nowrap;
  }

  .chip-place {
    overflow: hidden;
    color: var(--ui-text-3);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chip button {
    all: unset;
    display: grid;
    place-items: center;
    width: 14px;
    height: 14px;
    border-radius: var(--ui-radius-xs);
    color: var(--ui-text-3);
    cursor: pointer;
  }

  .chip button:hover {
    background: var(--ui-input-hover);
    color: var(--ui-text);
  }

  .tool {
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
  }

  .tool summary {
    display: flex;
    align-items: center;
    gap: 6px;
    height: var(--ui-hit);
    padding: 0 8px;
    color: var(--ui-text-2);
    cursor: pointer;
    list-style: none;
  }

  .tool summary::-webkit-details-marker {
    display: none;
  }

  .tool-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tool-status {
    display: grid;
    place-items: center;
    width: 14px;
    flex: none;
  }

  .tool[data-status='done'] .tool-status {
    color: #30d158;
  }

  .tool[data-status='failed'] .tool-status {
    color: #ff453a;
  }

  .tool :global(.tool-caret) {
    flex: none;
    transition: transform var(--ui-dur-fast);
  }

  .tool[open] :global(.tool-caret) {
    transform: rotate(90deg);
  }

  .tool .diff {
    margin: 0 8px 8px;
  }

  .spin {
    display: grid;
    animation: turn 1s linear infinite;
  }

  @keyframes turn {
    to {
      transform: rotate(360deg);
    }
  }

  .permission {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
    box-shadow: 0 0 0 1px var(--ui-accent);
  }

  .permission-head {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
  }

  .permission-head :global(svg) {
    flex: none;
    color: var(--ui-accent);
  }

  .answer {
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }

  .diff {
    font-family: var(--ui-mono, ui-monospace, monospace);
    font-size: var(--ui-text-xs);
    border-radius: var(--ui-radius-sm);
    overflow: hidden;
    max-height: 160px;
    overflow-y: auto;
    background: var(--ui-panel);
    padding: 4px 0;
  }

  .path {
    color: var(--ui-text-3);
    padding: 0 8px 2px;
  }

  .line {
    white-space: pre-wrap;
    padding: 0 8px;
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

  .choices {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
  }

  .choices button {
    height: var(--ui-hit);
    padding: 0 12px;
    border: 1px solid var(--ui-field-border);
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text);
    font: inherit;
    cursor: pointer;
  }

  .choices button:hover {
    background: var(--ui-input-hover);
  }

  .choices button.allow {
    border-color: transparent;
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
  }

  .thinking {
    display: flex;
    gap: 4px;
    padding: 4px 0 4px 22px;
  }

  .thinking span {
    width: 5px;
    height: 5px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-text-3);
    animation: pulse 1.2s ease-in-out infinite;
  }

  .thinking span:nth-child(2) {
    animation-delay: 0.15s;
  }

  .thinking span:nth-child(3) {
    animation-delay: 0.3s;
  }

  @keyframes pulse {
    0%,
    80%,
    100% {
      opacity: 0.25;
    }
    40% {
      opacity: 1;
    }
  }

  .composer {
    position: sticky;
    bottom: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border: 1px solid var(--ui-field-border);
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
  }

  .composer:focus-within {
    border-color: var(--ui-accent);
  }

  textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 0;
    border: 0;
    outline: 0;
    background: none;
    color: var(--ui-text);
    font: inherit;
    line-height: 1.5;
    resize: none;
  }

  textarea::placeholder {
    color: var(--ui-text-3);
  }

  .send {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  :global(.perm-trigger) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 20px;
    padding: 0 6px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-2);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  :global(.perm-trigger:hover),
  :global(.perm-trigger[data-state='open']) {
    background: var(--ui-input-hover);
    color: var(--ui-text);
  }

  :global(.perm-trigger.danger) {
    background: color-mix(in srgb, #ff9f0a 18%, transparent);
    color: #ff9f0a;
  }

  .agent-option.stacked {
    align-items: flex-start;
    height: auto;
    padding: 6px 8px;
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: left;
  }

  .hint {
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }

  .check {
    display: grid;
    place-items: center;
    width: 12px;
    height: 16px;
    flex: none;
  }

  .agent-option.danger .stack > span:first-child {
    color: #ff9f0a;
  }

  .round {
    display: grid;
    place-items: center;
    width: var(--ui-hit);
    height: var(--ui-hit);
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-full);
    background: var(--ui-input-hover);
    color: var(--ui-text);
    cursor: pointer;
  }

  .round.primary {
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
  }

  .round:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .thought {
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }
</style>
