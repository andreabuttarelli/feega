<script lang="ts">
  import type { Snippet } from 'svelte';
  import { composerHeight } from './composer-height';
  import { _ } from 'svelte-i18n';
  import IconButton from '$lib/components/motion/IconButton.svelte';
  import { Tool } from '$lib/motion/actions';
  import { CHAT_ATTACH_ACCEPT } from '$lib/chat-attachments';
  import ChatAttachments from './ChatAttachments.svelte';
  import ChatSelectionChips from './ChatSelectionChips.svelte';
  import type { SelectionChip } from '$lib/chat-selection';
  import type { Upload } from './chat-uploads.svelte';

  let {
    value = $bindable(),
    busy = false,
    enabled = true,
    onsend,
    onstop,
    controls,
    files = [],
    ready = 0,
    uploading = false,
    onfiles,
    onremove,
    selection = [],
    onunselect
  }: {
    value: string;
    busy?: boolean;
    enabled?: boolean;
    onsend: () => void;
    onstop: () => void;
    controls?: Snippet;
    files?: Upload[];
    ready?: number;
    uploading?: boolean;
    onfiles?: (files: File[]) => void;
    onremove?: (id: string) => void;
    selection?: SelectionChip[];
    onunselect?: (id: string) => void;
  } = $props();

  let textarea = $state<HTMLTextAreaElement | null>(null);
  let picker = $state<HTMLInputElement | null>(null);
  let dragging = $state(false);

  const canSend = $derived(!busy && enabled && !uploading && (!!value.trim() || ready > 0));

  function picked(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    onfiles?.([...(input.files ?? [])]);
    input.value = '';
  }

  function pasted(e: ClipboardEvent) {
    const pastedFiles = [...(e.clipboardData?.files ?? [])];
    if (!onfiles || !pastedFiles.length) {
      return;
    }
    e.preventDefault();
    onfiles(pastedFiles);
  }

  function dragged(e: DragEvent) {
    if (!onfiles || !e.dataTransfer?.types.includes('Files')) {
      return;
    }
    e.preventDefault();
    dragging = true;
  }

  function dropped(e: DragEvent) {
    dragging = false;
    if (!onfiles || !e.dataTransfer?.files.length) {
      return;
    }
    e.preventDefault();
    onfiles([...e.dataTransfer.files]);
  }

  function grow() {
    if (!textarea) {
      return;
    }
    textarea.style.height = 'auto';
    textarea.style.height = composerHeight(textarea.scrollHeight);
  }

  let grownFor: string | null = null;
  $effect(() => {
    if (value === grownFor) {
      return;
    }
    grownFor = value;
    grow();
  });

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) {
      return;
    }
    e.preventDefault();
    submit();
  }

  function submit() {
    if (canSend) {
      onsend();
    }
  }
</script>

<form
  class="composer"
  class:is-disabled={!enabled}
  class:dragging
  ondragover={dragged}
  ondragleave={() => (dragging = false)}
  ondrop={dropped}
  onsubmit={(e) => {
    e.preventDefault();
    submit();
  }}
>
  <div class="field">
  <ChatSelectionChips chips={selection} onremove={onunselect} />
  {#if files.length}
    <ChatAttachments items={files} {onremove} />
  {/if}
  {#if dragging}
    <p class="drop-hint" aria-hidden="true">{$_('chat.panel.attach.drop')}</p>
  {/if}
  <label class="sr-only" for="chat-composer-input">{$_('chat.panel.placeholder')}</label>
  <textarea
    id="chat-composer-input"
    bind:this={textarea}
    bind:value
    onkeydown={onKeydown}
    onpaste={pasted}
    rows="1"
    placeholder={$_('chat.panel.placeholder')}
    disabled={!enabled}
    enterkeyhint="send"
  ></textarea>
  </div>

  <div class="row">
    {#if onfiles}
      <span class="attach">
        <IconButton action={Tool.Attach} label={$_('chat.panel.attach.button')} data-testid="chat-attach" disabled={!enabled} onclick={() => picker?.click()} />
        <input bind:this={picker} class="sr-only" type="file" multiple accept={CHAT_ATTACH_ACCEPT} tabindex="-1" aria-hidden="true" onchange={picked} />
      </span>
    {/if}
    {#if controls}
      <div class="controls">{@render controls()}</div>
    {:else}
      <span class="hint">{$_('chat.panel.hint')}</span>
    {/if}
    {#if busy}
      <button type="button" class="act stop" onclick={onstop} aria-label={$_('chat.panel.stop')} title={$_('chat.panel.stop')}>
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="2" fill="currentColor" /></svg>
      </button>
    {:else}
      <button type="submit" class="act send" disabled={!canSend} aria-label={$_('chat.panel.send')} title={$_('chat.panel.send')}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" /></svg>
      </button>
    {/if}
  </div>
</form>

<style>
  .composer {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    padding: var(--ui-space-2);
    background: var(--ui-panel-raised);
    border: 1px solid var(--ui-divider);
    border-radius: var(--ui-radius-lg);
    box-shadow: var(--ui-shadow-float);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    padding: var(--ui-space-3);
    border: 1px solid transparent;
    border-radius: var(--ui-radius-md);
    background: var(--ui-panel-sunken);
    transition: border-color var(--ui-dur-fast) var(--ui-ease);
  }
  .field:focus-within {
    border-color: color-mix(in srgb, var(--ui-accent) 45%, transparent);
  }
  .composer.is-disabled {
    opacity: 0.6;
  }
  .composer.dragging .field {
    border-color: var(--ui-accent);
    background: var(--ui-selected);
  }
  .drop-hint {
    margin: 0;
    font-size: 12px;
    color: var(--ink-soft, #6e6e73);
  }
  .attach {
    flex: 0 0 auto;
    --ib-size: 44px;
    margin: -6px 0;
  }

  textarea {
    width: 100%;
    border: none;
    outline: none;
    resize: none;
    background: transparent;
    color: var(--ink, #1d1d1f);
    font: inherit;
    font-size: var(--chat-font, 14px);
    line-height: 1.5;
    max-height: 200px;
    padding: 0;
  }
  textarea::placeholder {
    color: var(--ink-faint, #86868b);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .controls {
    flex: 1 1 auto;
    min-width: 0;
  }
  .hint {
    font-size: 11.5px;
    color: var(--ink-faint, #86868b);
  }

  .act {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--chat-action, 32px);
    height: var(--chat-action, 32px);
    border: none;
    border-radius: var(--ui-radius-full);
    cursor: pointer;
    background: var(--ui-accent-solid);
    color: var(--ui-on-accent);
    transition: background var(--ui-dur-fast) var(--ui-ease);
  }
  .act:disabled {
    background: var(--ui-input);
    color: var(--ui-text-disabled);
    cursor: default;
  }
  .act:focus-visible {
    outline: 2px solid var(--accent, #c485fe);
    outline-offset: 2px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  @media (hover: none) {
    .composer {
      flex-direction: row;
      align-items: flex-end;
      gap: var(--ui-space-2);
    }
    textarea {
      padding: 0;
    }
    .hint {
      display: none;
    }
    .composer:has(.controls) {
      flex-wrap: wrap;
    }
    .field {
      flex: 1 1 0;
      padding: var(--ui-space-2) var(--ui-space-3);
    }
    .composer:has(.controls) .row {
      display: contents;
    }
    .controls {
      order: 2;
      flex-basis: 100%;
    }
  }
</style>
