<script lang="ts" module>
  const taken: { last: unknown } = { last: null };
</script>

<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { CHROME_LOADERS } from '$lib/canvas/chrome-loaders';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import { readChatPanelPx, writeChatPanelPx, readChatTab, writeChatTab, CHAT_PANEL, type ChatTab } from '$lib/shell-prefs';
  import { guideOpenRequest } from '$lib/canvas/guide-open';
  import { canvasSelection } from '$lib/canvas/promote-sheet';
  import CanvasGuideTab from './CanvasGuideTab.svelte';
  import { replaceState } from '$app/navigation';
  import { briefPrefill, type ChatPrefill } from '$lib/components/brand-agent/chat-prefill';
  import { handoffOf, withoutHandoff, type ChatHandoff } from '$lib/canvas/chat-handoff';

  let {
    projectId,
    brandSlug,
    open,
    viewOnly = false
  }: {
    projectId: string;
    brandSlug: string;
    open: boolean;
    viewOnly?: boolean;
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

  let prefill = $state<ChatPrefill | null>(null);

  $effect(() => {
    const handoff = $page.data.handoff as ChatHandoff | null | undefined;
    if (!browser || !handoff || handoff === taken.last || !handoffOf($page.url)) {
      return;
    }
    taken.last = handoff;
    selectTab('chat');
    prefill = briefPrefill(handoff.text, handoff.attachments, Date.now());
    replaceState(withoutHandoff($page.url), $page.state);
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
        {:else if viewOnly}
          <p class="chat-view-only" data-testid="chat-view-only">View only: the chat edits the canvas and spends credits. Ask an admin for edit access.</p>
        {:else if browser}
          {#await CHROME_LOADERS.chat() then { default: ChatPanel }}
            <ChatPanel {projectId} {prefill} context={() => ({ canvasId: get(page).params.canvasId ?? null, selection: get(canvasSelection) })} />
          {/await}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .chat-view-only {
    margin: 0;
    padding: var(--ui-space-4);
    color: var(--ui-text-secondary);
    font-size: var(--ui-type-caption);
  }

  .chat-pane {
    position: relative;
    flex: 0 0 auto;
    width: var(--chat-w);
    height: 100%;
    min-height: 0;
    display: flex;
    background: var(--ui-wash);
    border-left: 1px solid var(--ui-divider);
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
    align-self: flex-start;
    display: flex;
    gap: 2px;
    margin: 8px 12px 4px;
    padding: 2px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
  }

  .chat-tab {
    position: relative;
    height: 28px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    font: inherit;
    font-size: var(--ui-type-body);
    font-weight: var(--ui-weight-medium);
    color: var(--ui-text-secondary);
    cursor: pointer;
  }
  .chat-tab:hover {
    color: var(--ui-text);
  }
  .chat-tab.is-active {
    background: var(--ui-panel-raised);
    color: var(--ui-text);
    font-weight: var(--ui-weight-semibold);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.14);
  }
  .chat-tab:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
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
      background: var(--ui-panel);
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
