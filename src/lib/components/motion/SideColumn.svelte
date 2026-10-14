<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ChatPlace, SIDE_DEFAULT_PX, Side, sideWidth } from '$lib/motion/editor-layout';

  let {
    place,
    side,
    onside,
    widthPx,
    onwidth,
    oncommit,
    busy,
    chat,
    properties
  }: {
    place: ChatPlace;
    side: Side;
    onside: (side: Side) => void;
    widthPx: number;
    onwidth: (px: number) => void;
    oncommit?: () => void;
    busy: boolean;
    chat: Snippet;
    properties: Snippet;
  } = $props();

  const SEGMENTS: readonly { side: Side; label: string }[] = [
    { side: Side.Chat, label: 'Chat' },
    { side: Side.Properties, label: 'Properties' }
  ];
  const KEY_STEP_PX = 16;
  const KEY_DELTA: Record<string, number> = { ArrowLeft: KEY_STEP_PX, ArrowRight: -KEY_STEP_PX };

  const docked = $derived(place === ChatPlace.Column);
  const tabs: HTMLButtonElement[] = [];

  function other(current: Side): Side {
    return current === Side.Chat ? Side.Properties : Side.Chat;
  }

  function onTabKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
      return;
    }
    e.preventDefault();
    const next = other(side);
    onside(next);
    tabs[SEGMENTS.findIndex((s) => s.side === next)]?.focus();
  }

  function startResize(e: PointerEvent) {
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    const origin = { x: e.clientX, px: widthPx };
    const move = (m: PointerEvent) => onwidth(sideWidth(origin.px + origin.x - m.clientX, window.innerWidth));
    const end = () => {
      handle.removeEventListener('pointermove', move);
      oncommit?.();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('lostpointercapture', end, { once: true });
  }

  function onHandleKey(e: KeyboardEvent) {
    const delta = KEY_DELTA[e.key];
    if (!delta) {
      return;
    }
    e.preventDefault();
    onwidth(sideWidth(widthPx + delta, window.innerWidth));
    oncommit?.();
  }

  function reset() {
    onwidth(sideWidth(SIDE_DEFAULT_PX, window.innerWidth));
    oncommit?.();
  }
</script>

<div class="side" class:docked style={docked ? `--side-w: ${widthPx}px;` : undefined} data-testid="side-column">
  {#if docked}
    <div
      class="edge"
      role="separator"
      tabindex="0"
      aria-orientation="vertical"
      aria-label="Resize the side column"
      aria-valuenow={widthPx}
      data-testid="side-resize"
      onpointerdown={startResize}
      ondblclick={reset}
      onkeydown={onHandleKey}
    ></div>
    <div class="segments" role="tablist" aria-label="Side panel" tabindex="-1" onkeydown={onTabKey}>
      {#each SEGMENTS as segment, i (segment.side)}
        <button
          bind:this={tabs[i]}
          type="button"
          role="tab"
          id="side-tab-{segment.side}"
          aria-selected={side === segment.side}
          aria-controls="side-pane-{segment.side}"
          tabindex={side === segment.side ? 0 : -1}
          data-testid="side-tab-{segment.side}"
          onclick={() => onside(segment.side)}
          >{segment.label}{#if segment.side === Side.Chat && busy && side !== Side.Chat}<span class="activity" data-testid="chat-activity" aria-label="Agent running"></span>{/if}</button
        >
      {/each}
    </div>
  {/if}
  <div class="pane" id="side-pane-properties" data-pane="properties" role={docked ? 'tabpanel' : undefined} hidden={docked && side !== Side.Properties}>{@render properties()}</div>
  <div class="pane" id="side-pane-chat" data-pane="chat" role={docked ? 'tabpanel' : undefined} hidden={docked && side !== Side.Chat}>{@render chat()}</div>
</div>

<style>
  .side:not(.docked),
  .side:not(.docked) .pane {
    display: contents;
  }

  .docked {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
  }

  .docked .pane {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .docked .pane[hidden] {
    display: none;
  }

  .docked .pane > :global(*) {
    flex: 1;
    min-height: 0;
    border-left: 0;
  }

  .edge {
    position: absolute;
    top: 0;
    bottom: 0;
    left: -22px;
    width: 44px;
    z-index: 20;
    cursor: col-resize;
    touch-action: none;
  }

  .edge::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 21px;
    width: 2px;
    background: transparent;
  }

  .edge:hover::after,
  .edge:active::after,
  .edge:focus-visible::after {
    background: var(--ui-accent);
  }

  .edge:focus-visible {
    outline: none;
  }

  .segments {
    display: flex;
    flex-shrink: 0;
    align-self: flex-start;
    gap: 2px;
    margin: 8px 12px 4px;
    padding: 2px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
  }

  .segments button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 12px;
    border-radius: var(--ui-radius-sm);
    font-size: var(--ui-type-body);
    font-weight: var(--ui-weight-medium);
    color: var(--ui-text-secondary);
    transition: background-color var(--ui-dur-fast) var(--ui-ease), color var(--ui-dur-fast) var(--ui-ease);
  }

  .segments button:hover {
    color: var(--ui-text);
  }

  .segments button:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }

  .segments button[aria-selected='true'] {
    background: var(--ui-panel-raised);
    color: var(--ui-text);
    font-weight: var(--ui-weight-semibold);
    box-shadow: 0 1px 2px rgb(0 0 0 / 0.14);
  }

  .segments button:focus-visible {
    outline: 2px solid var(--ui-accent);
    outline-offset: -2px;
  }

  .activity {
    width: 6px;
    height: 6px;
    background: var(--ui-accent);
  }

</style>
