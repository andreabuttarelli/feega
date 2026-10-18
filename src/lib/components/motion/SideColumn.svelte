<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ChatPlace, SIDE_DEFAULT_PX, sideWidth } from '$lib/motion/editor-layout';
  import { rightBar } from '$lib/components/brand-agent/right-bar-host.svelte';

  let {
    place,
    widthPx,
    onwidth,
    oncommit,
    chat,
    properties
  }: {
    place: ChatPlace;
    widthPx: number;
    onwidth: (px: number) => void;
    oncommit?: () => void;
    chat: Snippet;
    properties: Snippet;
  } = $props();

  const KEY_STEP_PX = 16;
  const KEY_DELTA: Record<string, number> = { ArrowLeft: KEY_STEP_PX, ArrowRight: -KEY_STEP_PX };

  const docked = $derived(place === ChatPlace.Column);

  function into(node: HTMLElement, target: HTMLElement) {
    target.appendChild(node);
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
  {/if}
  {#if !docked}
    <div class="pane" data-pane="properties">{@render properties()}</div>
  {:else if rightBar.propertiesPane}
    <div class="pane in-bar" data-pane="properties" use:into={rightBar.propertiesPane}>{@render properties()}</div>
  {/if}
  <div class="pane" data-pane="chat">{@render chat()}</div>
</div>

<style>
  .side:not(.docked),
  .side:not(.docked) .pane {
    display: contents;
  }

  .docked {
    position: relative;
    isolation: isolate;
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
