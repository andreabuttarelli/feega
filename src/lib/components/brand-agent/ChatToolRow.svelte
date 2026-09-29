<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { toolLabel } from '$lib/chat-parts';
  import { TOOL_STATUS, canvasLinkOf, toolStatusOf, type ToolCall } from './chat-view';

  let { call, projectId }: { call: ToolCall; projectId: string } = $props();

  let open = $state(false);

  const status = $derived(toolStatusOf(call));
  const row = $derived(TOOL_STATUS[status]);
  const link = $derived(canvasLinkOf(call, projectId));
  const hasDetails = $derived(call.input !== undefined || call.output !== undefined || !!call.errorText);

  function pretty(value: unknown): string {
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  }
</script>

<li class="tool" data-tone={row.tone}>
  <div class="line">
    <span class="icon" aria-hidden="true">
      {#if status === 'running'}
        <span class="spin"></span>
      {:else if status === 'done'}
        <svg viewBox="0 0 16 16" width="14" height="14"><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" /></svg>
      {:else}
        <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" /></svg>
      {/if}
    </span>

    {#if hasDetails}
      <button type="button" class="name as-button" aria-expanded={open} onclick={() => (open = !open)}>
        <span class="label">{toolLabel(call.toolName)}</span>
        <svg class="chev" class:is-open={open} viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" /></svg>
      </button>
    {:else}
      <span class="name"><span class="label">{toolLabel(call.toolName)}</span></span>
    {/if}

    {#if link}
      <a class="link" href={link.href} title={$_('chat.panel.openOnCanvas')}>{link.label} →</a>
    {:else}
      <span class="status">{$_(row.labelKey)}</span>
    {/if}
  </div>

  {#if open}
    <div class="details">
      {#if call.errorText}
        <p class="err">{call.errorText}</p>
      {/if}
      {#if call.input !== undefined}
        <span class="cap">{$_('chat.panel.input')}</span>
        <pre>{pretty(call.input)}</pre>
      {/if}
      {#if call.output !== undefined}
        <span class="cap">{$_('chat.panel.output')}</span>
        <pre>{pretty(call.output)}</pre>
      {/if}
    </div>
  {/if}
</li>

<style>
  .tool {
    list-style: none;
    border-top: 1px solid var(--line, #ededef);
  }
  .tool:first-child {
    border-top: 0;
  }

  .line {
    display: grid;
    grid-template-columns: 16px auto minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    min-height: 34px;
    padding: 0 10px;
    font-size: 12.5px;
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--ink-faint, #86868b);
  }
  [data-tone='ok'] .icon {
    color: var(--ink, #1d1d1f);
  }
  [data-tone='danger'] .icon,
  [data-tone='danger'] .status {
    color: var(--danger, #c0392b);
  }

  .spin {
    width: 10px;
    height: 10px;
    border: 1.6px solid color-mix(in srgb, var(--ink, #1d1d1f) 18%, transparent);
    border-top-color: var(--ink, #1d1d1f);
    animation: spin 0.8s linear infinite;
  }

  .name {
    display: flex;
    flex: 0 1 auto;
    align-items: center;
    gap: 4px;
    min-width: 0;
    color: var(--ink, #1d1d1f);
    font-weight: 500;
  }
  .as-button {
    appearance: none;
    border: 0;
    background: none;
    padding: 0;
    font: inherit;
    text-align: left;
    cursor: pointer;
    min-height: 34px;
  }
  .as-button:focus-visible {
    outline: 2px solid var(--accent, #c485fe);
    outline-offset: 2px;
  }
  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .label::first-letter {
    text-transform: uppercase;
  }
  .chev {
    flex: 0 0 auto;
    color: var(--ink-faint, #86868b);
    transition: transform 0.14s ease;
  }
  .chev.is-open {
    transform: rotate(90deg);
  }

  .status,
  .link {
    justify-self: end;
    min-width: 0;
  }
  .status {
    color: var(--ink-faint, #86868b);
    font-size: 12px;
  }
  .link {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 500;
    color: var(--accent-ink, #6b4aa0);
    text-decoration: none;
  }
  .link:hover {
    text-decoration: underline;
  }
  .link:focus-visible {
    outline: 2px solid var(--accent, #c485fe);
    outline-offset: 2px;
  }

  .details {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 2px 10px 10px 34px;
  }
  .cap {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-faint, #86868b);
  }
  .err {
    margin: 0;
    font-size: 12px;
    color: var(--danger, #c0392b);
  }
  pre {
    margin: 0 0 4px;
    max-height: 220px;
    overflow: auto;
    padding: 8px;
    background: var(--paper-3, #f4f4f4);
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    font-size: 11.5px;
    line-height: 1.5;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .spin {
      animation: none;
    }
  }
</style>
