<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { renderDocHtml } from '$lib/canvas/doc-render';
  import ChatToolRow from './ChatToolRow.svelte';
  import type { ToolCall } from './chat-view';
  import type { ChatAttachment } from '$lib/chat-attachments';
  import { AssetSize, canvasAssetUrl } from '$lib/canvas/asset-url';
  import ChatAttachments from './ChatAttachments.svelte';
  import { UploadStatus } from './chat-uploads.svelte';

  const REASONING_PLACEHOLDER = '\u200b';

  let {
    role,
    content,
    projectId,
    pending = false,
    at = null,
    tools = [],
    reasoning = '',
    live = false,
    first = true,
    attachments = [],
    canvasId = ''
  }: {
    role: 'user' | 'assistant';
    content: string;
    projectId: string;
    pending?: boolean;
    at?: number | null;
    tools?: ToolCall[];
    reasoning?: string;
    live?: boolean;
    first?: boolean;
    attachments?: ChatAttachment[];
    canvasId?: string;
  } = $props();

  const chips = $derived(
    attachments.map((a) => ({
      id: a.assetId,
      name: a.name,
      bytes: a.bytes,
      kind: a.kind,
      preview: canvasId ? canvasAssetUrl(projectId, canvasId, a.assetId, AssetSize.Thumb) : null,
      progress: 1,
      status: UploadStatus.Ready
    }))
  );

  const time = $derived(at ? new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
  const html = $derived(role === 'assistant' && content ? renderDocHtml(content) : '');
  const thinking = $derived(pending && !content);
  const trace = $derived(reasoning.replace(REASONING_PLACEHOLDER, '').trim());
  const reasoningLive = $derived(live && !!reasoning && !content);
</script>

<div class="msg is-{role}" class:first class:live role="group" aria-label={role === 'user' ? $_('chat.panel.you') : $_('chat.panel.agent')}>
  {#if role === 'user'}
    {#if chips.length}
      <div class="user-files"><ChatAttachments items={chips} /></div>
    {/if}
    {#if content}
      <div class="user-body">{content}</div>
    {/if}
  {:else}
    {#if first}
      <div class="who">
        <span class="mark" aria-hidden="true"></span>
        <span>{$_('chat.panel.agent')}</span>
        {#if time && !live}<time>{time}</time>{/if}
      </div>
    {/if}

    {#if reasoning}
      <details class="trace" open={reasoningLive}>
        <summary class:live={reasoningLive}>{$_('chat.panel.reasoningTrace')}</summary>
        {#if trace}<p>{trace}</p>{/if}
      </details>
    {/if}

    {#if tools.length}
      <ul class="tools" aria-label={$_('chat.panel.tools', { values: { count: tools.length } })}>
        {#each tools as call, i (call.toolCallId ?? `${call.toolName}-${i}`)}
          <ChatToolRow {call} {projectId} {canvasId} />
        {/each}
      </ul>
    {/if}

    {#if thinking}
      <p class="thinking">
        <span class="bar" aria-hidden="true"></span>{$_('chat.panel.thinking')}
      </p>
    {:else if html}
      <div class="prose" class:streaming={live}>{@html html}</div>
    {/if}
  {/if}
</div>

<style>
  .user-files {
    align-self: flex-end;
    max-width: 100%;
  }
  .msg {
    display: flex;
    flex-direction: column;
    gap: 8px;
    animation: enter 0.18s var(--ease, cubic-bezier(0.22, 1, 0.36, 1));
  }
  .msg.first {
    margin-top: 12px;
  }

  .msg.is-user {
    align-items: flex-end;
  }
  .user-body {
    max-width: 85%;
    padding: 9px 12px;
    background: var(--paper-3, #f4f4f4);
    border: 1px solid var(--line, #ededef);
    color: var(--ink, #1d1d1f);
    font-size: var(--chat-font, 14px);
    line-height: 1.55;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .who {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--ink, #1d1d1f);
  }
  .mark {
    width: 10px;
    height: 10px;
    background: var(--accent, #c485fe);
  }
  .who time {
    font-weight: 400;
    color: var(--ink-faint, #86868b);
  }

  .tools {
    margin: 0;
    padding: 0;
    border: 1px solid var(--line, #ededef);
    background: var(--paper, #fff);
  }

  .trace {
    font-size: 12.5px;
    color: var(--ink-soft, #6e6e73);
  }
  .trace summary {
    cursor: pointer;
    width: fit-content;
  }
  .trace summary.live {
    animation: pulse 1.2s ease-in-out infinite;
  }
  .trace summary:focus-visible {
    outline: 2px solid var(--accent, #c485fe);
    outline-offset: 2px;
  }
  .trace p {
    margin: 6px 0 0;
    padding-left: 10px;
    border-left: 2px solid var(--line, #ededef);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    max-height: 240px;
    overflow-y: auto;
  }
  @keyframes pulse {
    50% {
      opacity: 0.45;
    }
  }

  .thinking {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 13px;
    color: var(--ink-soft, #6e6e73);
  }
  .bar {
    width: 18px;
    height: 3px;
    background: linear-gradient(90deg, var(--ink-faint, #86868b) 0 33%, transparent 33%);
    background-size: 300% 100%;
    animation: slide 1s linear infinite;
  }

  .prose {
    color: var(--ink, #1d1d1f);
    font-size: var(--chat-font, 14px);
    line-height: 1.6;
    overflow-wrap: anywhere;
  }
  .prose :global(> :first-child) {
    margin-top: 0;
  }
  .prose :global(> :last-child) {
    margin-bottom: 0;
  }
  .prose :global(p),
  .prose :global(ul),
  .prose :global(ol),
  .prose :global(pre),
  .prose :global(table),
  .prose :global(blockquote) {
    margin: 0 0 0.75em;
  }
  .prose :global(h1),
  .prose :global(h2),
  .prose :global(h3),
  .prose :global(h4) {
    margin: 1.1em 0 0.4em;
    font-size: 1em;
    font-weight: 700;
    line-height: 1.35;
  }
  .prose :global(h1) {
    font-size: 1.15em;
  }
  .prose :global(ul),
  .prose :global(ol) {
    padding-left: 1.4em;
  }
  .prose :global(ul) {
    list-style: disc;
  }
  .prose :global(ol) {
    list-style: decimal;
  }
  .prose :global(li) {
    margin: 0.2em 0;
  }
  .prose :global(li::marker) {
    color: var(--ink-faint, #86868b);
  }
  .prose :global(a) {
    color: var(--accent-ink, #6b4aa0);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .prose :global(code) {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 0.88em;
    padding: 1px 4px;
    background: var(--paper-3, #f4f4f4);
  }
  .prose :global(pre) {
    padding: 10px 12px;
    overflow-x: auto;
    background: var(--paper-3, #f4f4f4);
    border: 1px solid var(--line, #ededef);
  }
  .prose :global(pre code) {
    padding: 0;
    background: none;
    font-size: 12.5px;
    line-height: 1.55;
  }
  .prose :global(blockquote) {
    padding-left: 10px;
    border-left: 2px solid var(--line-2, #d2d2d7);
    color: var(--ink-soft, #6e6e73);
  }
  .prose :global(table) {
    display: block;
    overflow-x: auto;
    border-collapse: collapse;
    font-size: 0.93em;
  }
  .prose :global(th),
  .prose :global(td) {
    padding: 6px 10px;
    border: 1px solid var(--line, #ededef);
    text-align: left;
    vertical-align: top;
  }
  .prose :global(th) {
    background: var(--paper-3, #f4f4f4);
    font-weight: 600;
  }
  .prose :global(hr) {
    border: 0;
    border-top: 1px solid var(--line, #ededef);
    margin: 1em 0;
  }
  .prose.streaming :global(> :last-child::after) {
    content: '';
    display: inline-block;
    width: 7px;
    height: 1em;
    margin-left: 3px;
    vertical-align: -0.15em;
    background: var(--ink, #1d1d1f);
    animation: blink 1s step-end infinite;
  }

  @keyframes enter {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }
  @keyframes blink {
    50% {
      opacity: 0;
    }
  }
  @keyframes slide {
    from {
      background-position: 100% 0;
    }
    to {
      background-position: -50% 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .msg,
    .bar,
    .prose.streaming :global(> :last-child::after) {
      animation: none;
    }
  }
</style>
