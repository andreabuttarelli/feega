<script lang="ts">
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import Maximize from '@lucide/svelte/icons/maximize';
  import Minus from '@lucide/svelte/icons/minus';
  import Plus from '@lucide/svelte/icons/plus';
  import { untrack } from 'svelte';
  import { CANVAS_COLUMNS, layoutCanvas, type CanvasFrame } from './canvas-layout';
  import { LIVE_CAP, VISIBLE_MARGIN, leaving, liveKeys } from './canvas-live';
  import { openOf, type CanvasOpen } from './canvas-open';
  import { pageKeysOf } from './canvas-stale';
  import { shotOf } from './canvas-shot';
  import { CanvasKey, actualView, canvasKeyOf, fitView, panBy, percentOf, stepView, wheelOf, zoomAround, type CanvasView, type Point } from './canvas-view';
  import type { FilesChange } from './files-change';
  import type { PageRow } from './pages';
  import { SIZES } from './sizes';

  type Props = { rows: PageRow[]; base: string; onopen: (target: CanvasOpen) => void; onclose: () => void; changed: FilesChange | null };

  let { rows, base, onopen, onclose, changed }: Props = $props();

  const MIDDLE_BUTTON = 1;
  const SPACE_CODE = 'Space';
  const FIRST_SHOT_DELAY_MS = 800;
  const RECAPTURE_DELAY_MS = 1200;

  let root = $state<HTMLElement | null>(null);
  let viewport = $state({ w: 0, h: 0 });
  let view = $state<CanvasView>({ scale: 1, x: 0, y: 0 });
  let touched = $state(false);
  let fitted = false;
  let held = $state(false);
  let panning = $state(false);
  let shots = $state<Record<string, string>>({});
  let retiring = $state<string[]>([]);
  const frameEls: Record<string, HTMLIFrameElement | undefined> = {};
  let wasLive: string[] = [];
  let queue: Promise<void> = Promise.resolve();

  const layout = $derived(layoutCanvas(rows, CANVAS_COLUMNS));
  const live = $derived(liveKeys(layout.frames, view, viewport, VISIBLE_MARGIN, LIVE_CAP));
  const mounted = $derived(new Set([...live, ...retiring]));
  const currentRoute = $derived(rows.find((r) => r.current)?.route ?? null);

  const dimsOf = (f: CanvasFrame) => `${SIZES[f.size].label} · ${f.width} × ${f.height}`;

  function fit() {
    view = fitView(layout.bounds, viewport);
    touched = false;
  }

  $effect(() => {
    if (!touched && !fitted && viewport.w > 0) {
      view = fitView(layout.bounds, viewport);
      fitted = true;
    }
  });

  $effect(() => {
    if (!changed) {
      return;
    }
    const files = changed.files;
    untrack(() => {
      for (const key of pageKeysOf(layout.frames, files)) {
        if (!mounted.has(key)) {
          delete shots[key];
          continue;
        }
        setTimeout(() => void shoot(key), RECAPTURE_DELAY_MS);
      }
    });
  });

  function shoot(key: string): Promise<void> {
    queue = queue.then(async () => {
      const el = frameEls[key];
      const png = el ? await shotOf(el) : null;
      if (png) {
        shots[key] = png;
      }
    });

    return queue;
  }

  $effect(() => {
    const gone = leaving(wasLive, live);
    wasLive = live;
    for (const key of gone) {
      retiring = [...retiring, key];
      void shoot(key).finally(() => (retiring = retiring.filter((k) => k !== key)));
    }
  });

  function loaded(key: string) {
    setTimeout(() => void shoot(key), FIRST_SHOT_DELAY_MS);
  }

  function register(node: HTMLIFrameElement, key: string) {
    frameEls[key] = node;

    return { destroy: () => delete frameEls[key] };
  }

  const pointOf = (e: { clientX: number; clientY: number }): Point => {
    const box = root!.getBoundingClientRect();

    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };

  function onwheel(e: WheelEvent) {
    e.preventDefault();
    touched = true;
    const action = wheelOf(e);
    view = action.kind === 'zoom' ? zoomAround(view, action.factor, pointOf(e)) : panBy(view, action.dx, action.dy);
  }

  function attach(node: HTMLElement) {
    node.addEventListener('wheel', onwheel, { passive: false });

    return { destroy: () => node.removeEventListener('wheel', onwheel) };
  }

  function drag(start: PointerEvent) {
    let last = { x: start.clientX, y: start.clientY };
    const move = (e: PointerEvent) => {
      view = panBy(view, e.clientX - last.x, e.clientY - last.y);
      last = { x: e.clientX, y: e.clientY };
    };
    const end = () => {
      panning = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    panning = true;
    touched = true;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  }

  function press(e: PointerEvent) {
    if (e.button === MIDDLE_BUTTON || (held && e.button === 0)) {
      e.preventDefault();
      e.stopPropagation();
      drag(e);
    }
  }

  function step(direction: 1 | -1) {
    touched = true;
    view = stepView(view, direction, viewport);
  }

  function run(key: CanvasKey) {
    const actions: Record<CanvasKey, () => void> = {
      [CanvasKey.In]: () => step(1),
      [CanvasKey.Out]: () => step(-1),
      [CanvasKey.Fit]: fit,
      [CanvasKey.Actual]: () => ((touched = true), (view = actualView(view, viewport))),
      [CanvasKey.Close]: onclose
    };
    actions[key]();
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.code === SPACE_CODE) {
      e.preventDefault();
      held = true;
      return;
    }
    const key = canvasKeyOf(e);
    if (key) {
      e.preventDefault();
      run(key);
    }
  }

  const onkeyup = (e: KeyboardEvent) => e.code === SPACE_CODE && (held = false);

  function open(frame: CanvasFrame) {
    const target = openOf(frame);
    if (target) {
      onopen(target);
    }
  }
</script>

<svelte:window {onkeydown} {onkeyup} onblur={() => (held = false)} />

<div
  class="canvas"
  role="application"
  aria-label="Pages canvas"
  data-testid="pages-canvas"
  data-scale={view.scale}
  bind:this={root}
  bind:clientWidth={viewport.w}
  bind:clientHeight={viewport.h}
  use:attach
  onpointerdowncapture={press}
  style={`background-position:${view.x}px ${view.y}px`}
>
  <div class="world" style={`transform:translate(${view.x}px,${view.y}px) scale(${view.scale});--zoom:${view.scale}`}>
    {#each layout.rows as row (row.route)}
      <h2 class="row-label" class:on={row.route === currentRoute} style={`left:0;top:${row.y}px`} data-testid="canvas-row">{row.route}{#if row.dynamic}<span class="tag">dynamic</span>{/if}</h2>
    {/each}

    {#each layout.frames as frame (frame.key)}
      <div class="frame" class:dynamic={frame.dynamic} style={`left:${frame.x}px;top:${frame.y}px;width:${frame.width}px;height:${frame.height}px`} data-testid="canvas-frame" data-key={frame.key} data-live={live.includes(frame.key)}>
        <span class="frame-label">{dimsOf(frame)}</span>
        {#if shots[frame.key]}<img class="shot" src={shots[frame.key]} alt="" draggable="false" />{:else}
          <div class="card"><b>{frame.route}</b><span>{frame.dynamic ? 'Dynamic route' : dimsOf(frame)}</span></div>
        {/if}
        {#if mounted.has(frame.key)}
          <iframe use:register={frame.key} src={new URL(frame.route, base).toString()} title={`${frame.route} ${SIZES[frame.size].label}`} tabindex="-1" onload={() => loaded(frame.key)} style={`width:${frame.width}px;height:${frame.height}px`}></iframe>
        {/if}
        <button type="button" class="hit" disabled={frame.dynamic} title={frame.dynamic ? 'Dynamic route: open it from a link in the preview' : `Open ${frame.route} at ${SIZES[frame.size].label}`} aria-label={`Open ${frame.route} at ${SIZES[frame.size].label}`} data-testid="canvas-open" onclick={() => open(frame)}></button>
      </div>
    {/each}
  </div>

  {#if held}<div class="panner" class:grabbing={panning} data-testid="canvas-panner"></div>{/if}

  <button type="button" class="back" data-testid="canvas-close" title="Back to the editor (Esc)" onclick={onclose}><ArrowLeft size={14} />Editor</button>

  <div class="zoombar" data-testid="canvas-zoom">
    <button type="button" aria-label="Zoom out" title="Zoom out (-)" onclick={() => step(-1)}><Minus size={14} /></button>
    <span class="percent" data-testid="canvas-percent">{percentOf(view.scale)}</span>
    <button type="button" aria-label="Zoom in" title="Zoom in (+)" onclick={() => step(1)}><Plus size={14} /></button>
    <button type="button" aria-label="Zoom to fit" title="Zoom to fit (0)" data-testid="canvas-fit" onclick={fit}><Maximize size={14} /></button>
  </div>
</div>

<style>
  .canvas {
    position: absolute;
    inset: 0;
    z-index: 20;
    overflow: hidden;
    background-color: var(--ui-backdrop);
    background-image: radial-gradient(circle, color-mix(in srgb, var(--ui-text) 14%, transparent) 1px, transparent 1px);
    background-size: 24px 24px;
    user-select: none;
  }

  .world {
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    transform-origin: 0 0;
    --label: min(calc(12px / var(--zoom)), 80px);
  }

  .row-label {
    position: absolute;
    margin: 0;
    color: var(--ui-text-2);
    font-size: calc(var(--label) * 1.15);
    font-weight: 500;
    white-space: nowrap;
  }

  .row-label.on {
    color: var(--ui-text);
  }

  .tag {
    margin-left: 0.6em;
    padding: 0 0.5em;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    font-size: 0.8em;
    font-weight: 400;
  }

  .frame {
    position: absolute;
    background: var(--ui-panel);
    box-shadow: 0 0 0 calc(1px / var(--zoom)) var(--ui-divider);
  }

  .frame-label {
    position: absolute;
    bottom: 100%;
    left: 0;
    padding-bottom: calc(6px / var(--zoom));
    color: var(--ui-text-2);
    font-size: var(--label);
    white-space: nowrap;
  }

  .shot,
  iframe {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    pointer-events: none;
  }

  iframe {
    background: white;
  }

  .card {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: calc(4px / var(--zoom));
    color: var(--ui-text-2);
    font-size: min(calc(13px / var(--zoom)), 120px);
  }

  .card b {
    color: var(--ui-text);
    font-weight: 500;
  }

  .hit {
    position: absolute;
    inset: 0;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
  }

  .hit:hover:not(:disabled),
  .hit:focus-visible {
    outline: calc(2px / var(--zoom)) solid var(--ui-accent);
    outline-offset: calc(2px / var(--zoom));
  }

  .hit:disabled {
    cursor: default;
  }

  .frame:has(.hit:hover:not(:disabled)) .frame-label {
    color: var(--ui-accent-text);
  }

  .panner {
    position: absolute;
    inset: 0;
    z-index: 5;
    cursor: grab;
  }

  .panner.grabbing {
    cursor: grabbing;
  }

  .back {
    position: absolute;
    top: 12px;
    left: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    border: 0;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-panel);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-sm);
    cursor: pointer;
  }

  .zoombar {
    position: absolute;
    bottom: 12px;
    left: 50%;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-panel);
    transform: translateX(-50%);
  }

  .zoombar button {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-2);
    cursor: pointer;
  }

  .zoombar button:hover,
  .back:hover {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .percent {
    min-width: 44px;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
</style>
