<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import X from '@lucide/svelte/icons/x';
  import { localStore } from '$lib/browser-storage';
  import { isTap } from '$lib/motion/editor-bar';
  import { portalInto } from '$lib/components/brand-agent/right-bar-host.svelte';
  import { Detent, fitHeight, readSheetPx, settleHeight, sheetHeight, tapHeight, writeSheetPx, type SheetRoom } from '$lib/motion/sheet-detents';

  let {
    name,
    title,
    open,
    onclose,
    floorPx,
    opensAt = Detent.Half,
    testid,
    children
  }: { name: string; title: string; open: boolean; onclose: () => void; floorPx: number; opensAt?: Detent; testid: string; children: Snippet } = $props();

  let viewportH = $state(0);
  let heightPx = $state<number | null>(readSheetPx(localStore(), untrack(() => name)));
  let drag = $state<{ y: number; from: number; height: number } | null>(null);

  const room = (): SheetRoom => ({ viewport: viewportH, stageBottom: viewportH / 2, floor: floorPx });
  const shownPx = $derived(drag?.height ?? (viewportH ? fitHeight(heightPx ?? sheetHeight(opensAt, room()), room()) : 0));

  function grab(e: PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag = { y: e.clientY, from: shownPx, height: shownPx };
  }

  function move(e: PointerEvent) {
    if (drag) {
      drag = { ...drag, height: Math.max(0, drag.from + drag.y - e.clientY) };
    }
  }

  function drop(e: PointerEvent) {
    if (!drag) {
      return;
    }
    const moved = !isTap({ x: 0, y: drag.y }, { x: 0, y: e.clientY });
    heightPx = moved ? settleHeight(drag.height, room()) : tapHeight(shownPx, room());
    drag = null;
    writeSheetPx(localStore(), name, heightPx);
  }
</script>

<svelte:window bind:innerHeight={viewportH} />

<section
  class="phone-sheet"
  class:dragging={drag}
  hidden={!open}
  aria-label={title}
  data-testid={testid}
  data-sheet-px={Math.round(shownPx)}
  style={`height: ${shownPx}px; bottom: calc(${floorPx}px + env(safe-area-inset-bottom, 0px));`}
  use:portalInto={document.body}
>
  <header class="head">
    <button type="button" class="grabber" aria-label="Resize the sheet" data-testid="phone-sheet-grabber" onpointerdown={grab} onpointermove={move} onpointerup={drop} onpointercancel={drop}><i aria-hidden="true"></i></button>
    <span class="title">{title}</span>
    <button type="button" class="close" aria-label="Close" onclick={onclose}><X size={18} /></button>
  </header>
  <div class="body">{@render children()}</div>
</section>

<style>
  .phone-sheet {
    position: fixed;
    left: 0;
    right: 0;
    z-index: 80;
    display: flex;
    flex-direction: column;
    border-radius: var(--ui-radius-lg) var(--ui-radius-lg) 0 0;
    background: var(--ui-panel-raised);
    box-shadow: 0 -12px 32px rgb(0 0 0 / 0.16);
    transition: height 160ms ease;
  }

  .phone-sheet[hidden] {
    display: none;
  }

  .phone-sheet.dragging {
    transition: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .phone-sheet {
      transition: none;
    }
  }

  .head {
    position: relative;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 52px;
    padding: 0 4px 0 16px;
    font-size: var(--ui-type-body);
    font-weight: var(--ui-weight-semibold);
    color: var(--ui-text);
  }

  .grabber {
    position: absolute;
    top: 0;
    left: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 88px;
    height: 44px;
    margin-left: -44px;
    border: 0;
    background: none;
    touch-action: none;
    cursor: ns-resize;
  }

  .grabber i {
    width: 36px;
    height: 4px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-text-3);
  }

  .close {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-icon-ink);
  }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0 8px 8px;
  }
</style>
