<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { CHROME_LOADERS } from '$lib/canvas/chrome-loaders';
  import { browser } from '$app/environment';
  import { readChatPanelPx, writeChatPanelPx, readChatTab, writeChatTab, CHAT_PANEL, type ChatTab } from '$lib/shell-prefs';
  import { guideOpenRequest } from '$lib/canvas/guide-open';
  import CanvasGuideTab from './CanvasGuideTab.svelte';

  let {
    projectId,
    brandSlug,
    open
  }: {
    projectId: string;
    brandSlug: string;
    open: boolean;
  } = $props();

  let widthPx = $state(readChatPanelPx());
  let tab = $state<ChatTab>(readChatTab());

  function selectTab(next: ChatTab) {
    tab = next;
    writeChatTab(next);
  }

  $effect(() => {
    if ($guideOpenRequest) selectTab('guide');
  });

  function onResizeStart(e: PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widthPx;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const next = startW - (ev.clientX - startX);
      widthPx = Math.min(CHAT_PANEL.MAX, Math.max(CHAT_PANEL.MIN, Math.round(next)));
    };
    const onUp = () => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
      writeChatPanelPx(widthPx);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  }
</script>

{#if open}
  <div class="chat-pane" style={`--chat-w: ${widthPx}px;`}>
    <div
      class="chat-resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label={$_('app.shell.resizeChat')}
      tabindex="0"
      onpointerdown={onResizeStart}
    ></div>
    <div class="chat-column">
      <nav class="chat-tabs" aria-label={$_('app.shell.rail')}>
        <button type="button" class="chat-tab" aria-pressed={tab === 'chat'} class:is-active={tab === 'chat'} onclick={() => selectTab('chat')}>
          {$_('app.shell.chatTab')}
        </button>
        <button type="button" class="chat-tab" aria-pressed={tab === 'guide'} class:is-active={tab === 'guide'} onclick={() => selectTab('guide')}>
          {$_('app.shell.guideTab')}
        </button>
      </nav>
      <div class="chat-body" class:is-guide={tab === 'guide'}>
        {#if tab === 'guide'}
          <CanvasGuideTab initialSlug={$guideOpenRequest} onopened={() => guideOpenRequest.set(null)} />
        {:else if browser}
          {#await CHROME_LOADERS.chat() then { default: ChatPanel }}
            <ChatPanel {projectId} {brandSlug} />
          {/await}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .chat-pane {
    position: relative;
    flex: 0 0 auto;
    width: var(--chat-w);
    height: 100%;
    min-height: 0;
    display: flex;
    background: var(--paper-2, #f9f9f9);
    border-left: 1px solid var(--line, #ededef);
  }

  .chat-resize-handle {
    position: absolute;
    left: -3px;
    top: 0;
    bottom: 0;
    width: 6px;
    cursor: col-resize;
    touch-action: none;
    background: transparent;
    transition: background 0.14s ease;
    z-index: 1;
  }
  .chat-resize-handle:hover,
  .chat-resize-handle:focus-visible {
    background: color-mix(in srgb, var(--accent, #c485fe) 45%, transparent);
    outline: none;
  }

  .chat-column {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .chat-tabs {
    flex: 0 0 auto;
    display: flex;
    gap: 16px;
    height: 44px;
    padding: 0 16px;
    border-bottom: 1px solid var(--line, #ededef);
  }

  .chat-tab {
    position: relative;
    padding: 0;
    border: 0;
    background: transparent;
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    color: var(--ink-soft, #6e6e73);
    cursor: pointer;
  }
  .chat-tab:hover {
    color: var(--ink, #1d1d1f);
  }
  .chat-tab.is-active {
    color: var(--ink, #1d1d1f);
    font-weight: 600;
  }
  .chat-tab.is-active::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -1px;
    height: 2px;
    background: var(--ink, #1d1d1f);
  }
  .chat-tab:focus-visible {
    outline: 2px solid var(--accent, #c485fe);
    outline-offset: 2px;
  }

  .chat-body {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .chat-body.is-guide {
    padding: 10px 12px;
    overflow: auto;
  }

  @media (max-width: 767px) {
    .chat-pane {
      width: 100%;
      border-left: 0;
      background: var(--paper, #fff);
    }
    .chat-resize-handle {
      display: none;
    }
    .chat-tab {
      min-width: 44px;
      font-size: 14px;
    }
  }
</style>
