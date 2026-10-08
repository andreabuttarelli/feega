<script lang="ts">
  import type { Snippet } from 'svelte';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import IconButton from './IconButton.svelte';
  import { Action } from '$lib/motion/actions';
  import { isTyping } from '$lib/motion/shortcuts';
  import { ACTUAL_SIZE, FIT, Step, panBy, scaleOf, zoomAt, zoomLabel, zoomStep, type Point, type Size, type View } from '$lib/motion/preview-view';

  let { frame, view = $bindable(FIT), onspace, children }: { frame: Size; view?: View; onspace?: () => void; children: Snippet } = $props();

  const WHEEL_ZOOM_RATE = 0.01;
  const DOUBLE_TAP_MS = 300;
  const DOUBLE_TAP_PX = 24;
  const MIDDLE_BUTTON = 1;
  const SPACE = ' ';
  const MENU_PRESETS = [0.5, 1, 2];

  let host = $state<HTMLDivElement | null>(null);
  let box = $state<Size>({ width: 1, height: 1 });
  let menuOpen = $state(false);
  let spaceHeld = $state(false);
  let hovering = false;
  let spacePanned = false;

  const scale = $derived(scaleOf(view, frame, box));
  const zoomed = $derived(view.scale !== null);
  const label = $derived(zoomLabel(view, scale));

  type Touch = { x: number; y: number };
  const touches = new Map<number, Touch>();
  let pinch: { distance: number; mid: Point; start: View } | null = null;
  let drag: { pointer: number; last: Touch } | null = null;
  let lastTap: { at: number; x: number; y: number } | null = null;

  function fromCentre(clientX: number, clientY: number): Point {
    const rect = host!.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  }

  const zoomTo = (next: number, anchor: Point = { x: 0, y: 0 }) => (view = zoomAt(view, next, anchor, frame, box));

  export const zoomIn = () => zoomTo(zoomStep(scale, Step.In));
  export const zoomOut = () => zoomTo(zoomStep(scale, Step.Out));
  export const fit = () => (view = FIT);
  export const actual = (anchor?: Point) => zoomTo(ACTUAL_SIZE, anchor);

  function toggleFit(anchor: Point) {
    if (zoomed) {
      fit();
      return;
    }
    actual(anchor);
  }

  function onWheel(e: WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      zoomTo(scale * Math.exp(-e.deltaY * WHEEL_ZOOM_RATE), fromCentre(e.clientX, e.clientY));
      return;
    }
    if (!zoomed) {
      return;
    }
    e.preventDefault();
    view = panBy(view, { x: -e.deltaX, y: -e.deltaY }, frame, box);
  }

  $effect(() => {
    const el = host;
    if (!el) {
      return;
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const centre = () => {
    const [a, b] = [...touches.values()];
    return { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: fromCentre((a.x + b.x) / 2, (a.y + b.y) / 2) };
  };

  function down(e: PointerEvent) {
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (touches.size === 2) {
      e.stopPropagation();
      pinch = { ...centre(), start: view };
      return;
    }
    if (!spaceHeld && e.button !== MIDDLE_BUTTON) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    host!.setPointerCapture(e.pointerId);
    drag = { pointer: e.pointerId, last: { x: e.clientX, y: e.clientY } };
    spacePanned = spacePanned || spaceHeld;
  }

  function moved(e: PointerEvent) {
    if (touches.has(e.pointerId)) {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (pinch && touches.size === 2) {
      e.stopPropagation();
      const now = centre();
      const scaled = zoomAt(pinch.start, scaleOf(pinch.start, frame, box) * (now.distance / pinch.distance), pinch.mid, frame, box);
      view = panBy(scaled, { x: now.mid.x - pinch.mid.x, y: now.mid.y - pinch.mid.y }, frame, box);
      return;
    }
    if (drag?.pointer !== e.pointerId) {
      return;
    }
    e.stopPropagation();
    view = panBy(view, { x: e.clientX - drag.last.x, y: e.clientY - drag.last.y }, frame, box);
    drag.last = { x: e.clientX, y: e.clientY };
  }

  function up(e: PointerEvent) {
    const wasPinching = pinch !== null;
    touches.delete(e.pointerId);
    if (touches.size < 2) {
      pinch = null;
    }
    if (drag?.pointer === e.pointerId) {
      drag = null;
      return;
    }
    if (wasPinching) {
      e.stopPropagation();
    }
  }

  function tapped(e: PointerEvent) {
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains('frame-box')) {
      return;
    }
    const at = performance.now();
    const near = lastTap && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < DOUBLE_TAP_PX;
    if (lastTap && near && at - lastTap.at < DOUBLE_TAP_MS) {
      lastTap = null;
      toggleFit(fromCentre(e.clientX, e.clientY));
      return;
    }
    lastTap = { at, x: e.clientX, y: e.clientY };
  }

  function keyDown(e: KeyboardEvent) {
    if (e.key !== SPACE || !hovering || !zoomed || isTyping(e.target as HTMLElement | null)) {
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat) {
      spaceHeld = true;
      spacePanned = false;
    }
  }

  function keyUp(e: KeyboardEvent) {
    if (e.key !== SPACE || !spaceHeld) {
      return;
    }
    spaceHeld = false;
    if (!spacePanned) {
      onspace?.();
    }
  }

  $effect(() => {
    window.addEventListener('keydown', keyDown, { capture: true });
    window.addEventListener('keyup', keyUp, { capture: true });
    return () => {
      window.removeEventListener('keydown', keyDown, { capture: true });
      window.removeEventListener('keyup', keyUp, { capture: true });
    };
  });

  function pick(next: number | null) {
    menuOpen = false;
    if (next === null) {
      fit();
      return;
    }
    zoomTo(next);
  }
</script>

<div
  class="zoom-stage"
  class:hand={spaceHeld || drag !== null}
  bind:this={host}
  role="presentation"
  data-testid="zoom-stage"
  data-zoom={label}
  onpointerdowncapture={down}
  onpointermovecapture={moved}
  onpointerupcapture={up}
  onpointercancelcapture={up}
  onpointerup={tapped}
  onpointerenter={() => (hovering = true)}
  onpointerleave={() => (hovering = false)}
>
  <div class="frame-box" bind:clientWidth={box.width} bind:clientHeight={box.height} style={zoomed ? `--preview-w: ${frame.width * scale}px; transform: translate(${view.x}px, ${view.y}px);` : ''}>
    {@render children()}
  </div>
</div>

<div class="zoom-control" role="group" aria-label="Preview zoom" data-testid="preview-zoom">
  <IconButton action={Action.PreviewZoomOut} size={14} onclick={zoomOut} />
  <button type="button" class="value" aria-haspopup="menu" aria-expanded={menuOpen} data-testid="preview-zoom-value" onclick={() => (menuOpen = !menuOpen)}>{label}<ChevronDown size={12} /></button>
  <IconButton action={Action.PreviewZoomIn} size={14} onclick={zoomIn} />
  {#if menuOpen}
    <div class="presets" role="menu">
      <button type="button" role="menuitem" onclick={() => pick(null)}><span>Fit</span><kbd>⌘0</kbd></button>
      {#each MENU_PRESETS as preset (preset)}
        <button type="button" role="menuitem" onclick={() => pick(preset)}><span>{preset * 100}%</span>{#if preset === ACTUAL_SIZE}<kbd>⌘1</kbd>{/if}</button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .zoom-stage {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
  }

  .zoom-stage.hand {
    cursor: grab;
  }

  .frame-box {
    position: absolute;
    inset: var(--stage-pad, var(--ui-space-6));
    display: flex;
    align-items: center;
    justify-content: center;
    container-type: size;
  }

  .zoom-control {
    position: absolute;
    bottom: 0;
    right: var(--ui-space-2);
    z-index: 4;
    display: flex;
    align-items: center;
    background: var(--ui-bg);
    outline: 1px solid var(--ui-line);
  }

  .value {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-width: 64px;
    height: var(--ui-hit);
    padding: 0 var(--ui-space-2);
    border: 0;
    background: none;
    color: var(--ui-ink-2);
    font: inherit;
    font-size: var(--ui-text-sm);
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }

  .presets {
    position: absolute;
    bottom: 100%;
    right: 0;
    display: flex;
    flex-direction: column;
    min-width: 140px;
    background: var(--ui-bg);
    outline: 1px solid var(--ui-line);
  }

  .presets button {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: var(--ui-hit);
    padding: 0 var(--ui-space-3);
    border: 0;
    background: none;
    color: var(--ui-ink);
    font: inherit;
    font-size: var(--ui-text-sm);
    cursor: pointer;
  }

  .presets button:hover {
    background: var(--ui-surface);
  }

  kbd {
    color: var(--ui-ink-3);
    font: inherit;
  }
</style>
