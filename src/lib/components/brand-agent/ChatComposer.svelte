<script lang="ts">
  import { composerHeight } from './composer-height';
  import { _ } from 'svelte-i18n';

  let {
    value = $bindable(),
    busy = false,
    enabled = true,
    onsend,
    onstop
  }: {
    value: string;
    busy?: boolean;
    enabled?: boolean;
    onsend: () => void;
    onstop: () => void;
  } = $props();

  let textarea = $state<HTMLTextAreaElement | null>(null);

  const canSend = $derived(!busy && enabled && !!value.trim());

  function grow() {
    if (!textarea) {
      return;
    }
    textarea.style.height = 'auto';
    textarea.style.height = composerHeight(textarea.scrollHeight);
  }

  $effect(() => {
    void value;
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
  onsubmit={(e) => {
    e.preventDefault();
    submit();
  }}
>
  <label class="sr-only" for="chat-composer-input">{$_('chat.panel.placeholder')}</label>
  <textarea
    id="chat-composer-input"
    bind:this={textarea}
    bind:value
    onkeydown={onKeydown}
    rows="1"
    placeholder={$_('chat.panel.placeholder')}
    disabled={!enabled}
    enterkeyhint="send"
  ></textarea>

  <div class="row">
    <span class="hint">{$_('chat.panel.hint')}</span>
    {#if busy}
      <button type="button" class="act stop" onclick={onstop} aria-label={$_('chat.panel.stop')} title={$_('chat.panel.stop')}>
        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><rect x="3" y="3" width="10" height="10" fill="currentColor" /></svg>
      </button>
    {:else}
      <button type="submit" class="act send" disabled={!canSend} aria-label={$_('chat.panel.send')} title={$_('chat.panel.send')}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" /></svg>
      </button>
    {/if}
  </div>
</form>

<style>
  .composer {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 10px 10px 8px 12px;
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    transition: border-color 0.14s ease, box-shadow 0.14s ease;
  }
  .composer:focus-within {
    border-color: var(--ink-soft, #6e6e73);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #c485fe) 22%, transparent);
  }
  .composer.is-disabled {
    opacity: 0.6;
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
    cursor: pointer;
    background: var(--ink, #1d1d1f);
    color: var(--paper, #fff);
    transition: opacity 0.14s ease, background 0.14s ease;
  }
  .act:disabled {
    background: var(--paper-3, #f4f4f4);
    color: var(--ink-faint, #86868b);
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
      gap: 8px;
      padding: 6px 6px 6px 12px;
    }
    textarea {
      align-self: center;
      padding: 6px 0;
    }
    .hint {
      display: none;
    }
  }
</style>
