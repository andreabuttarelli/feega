<script lang="ts" module>
  const taken: { last: unknown } = { last: null };
</script>

<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import { readChatPanelPx, writeChatPanelPx, CHAT_PANEL } from '$lib/shell-prefs';
  import { canvasSelection } from '$lib/canvas/promote-sheet';
  import { replaceState } from '$app/navigation';
  import { briefPrefill, type ChatPrefill } from '$lib/components/brand-agent/chat-prefill';
  import { handoffOf, withoutHandoff, type ChatHandoff } from '$lib/canvas/chat-handoff';
  import BarSlot from '$lib/components/brand-agent/BarSlot.svelte';
  import { BarTab, rightBar } from '$lib/components/brand-agent/right-bar-host.svelte';

  let { open }: { open: boolean } = $props();

  let widthPx = $state(readChatPanelPx());
  let prefill = $state<ChatPrefill | null>(null);

  $effect(() => {
    const handoff = $page.data.handoff as ChatHandoff | null | undefined;
    if (!browser || !handoff || handoff === taken.last || !handoffOf($page.url)) {
      return;
    }
    taken.last = handoff;
    rightBar.select(BarTab.Chat);
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
      <BarSlot {prefill} context={() => ({ canvasId: get(page).params.canvasId ?? null, selection: get(canvasSelection) })} />
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

  @media (max-width: 767px) {
    .chat-pane {
      flex: 1 1 auto;
      width: 100%;
      height: auto;
      border-left: 0;
      background: var(--ui-panel);
    }
    .chat-resize-handle {
      display: none;
    }
  }
</style>
