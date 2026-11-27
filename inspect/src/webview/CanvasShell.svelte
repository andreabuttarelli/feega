<script lang="ts" generics="F extends Placed">
  import Maximize from '@lucide/svelte/icons/maximize';
  import Minus from '@lucide/svelte/icons/minus';
  import Plus from '@lucide/svelte/icons/plus';
  import type { Snippet } from 'svelte';
  import type { Bounds } from './canvas-layout';
  import { labelMetrics } from './canvas-labels';
  import { liveSet } from './canvas-live';
  import { LOAD_TIMEOUT_MS, MAX_LOADING, PAINT_DELAY_MS, POOL_CAP, SETTLE_MS, planPool, settler } from './canvas-pool';
  import { shotOf } from './canvas-shot';
  import type { Hit } from './canvas-open';
  import type { Placed } from './canvas-live';
  import { CanvasKey, actualView, canvasKeyOf, fitView, panBy, percentOf, stepView, wheelOf, zoomAround, type CanvasView, type Point, type Viewport } from './canvas-view';
  import { untrack } from 'svelte';

  type Snapshot = { url: string; capped: boolean };

  type Props = {
    frames: F[];
    bounds: Bounds;
    label: string;
    testid: string;
    minLiveWidth?: number;
    frameLabel: (frame: F) => string;
    srcOf?: (frame: F) => string | null;
    hitOf: (frame: F) => Hit;
    onopen: (frame: F) => void;
    onclose: () => void;
    stale?: { keys: string[] } | null;
    snapshots?: Record<string, Snapshot>;
    unrendered?: string[];
    onview?: (view: CanvasView, viewport: Viewport) => void;
    world?: Snippet;
    card: Snippet<[F, boolean]>;
  };

  let { frames, bounds, label, testid, minLiveWidth = 0, frameLabel, srcOf = () => null, hitOf, onopen, onclose, stale = null, snapshots, unrendered = [], onview, world, card }: Props = $props();

  const MIDDLE_BUTTON = 1;
  const SPACE_CODE = 'Space';
  const FIRST_SHOT_DELAY_MS = 800;
  const RECAPTURE_DELAY_MS = 1200;
  const MOUNT_STATUS = 'feega:mount:status';
  const MOUNT_FAILED = 'failed';

  let root = $state<HTMLElement | null>(null);
  let viewport = $state({ w: 0, h: 0 });
  let view = $state<CanvasView>({ scale: 1, x: 0, y: 0 });
  let touched = $state(false);
  let fitted = false;
  let failed = $state<string[]>([]);
  let held = $state(false);
  let panning = $state(false);
  let shots = $state<Record<string, string>>({});
  let retiring = $state<string[]>([]);
  let settledView = $state<CanvasView>({ scale: 1, x: 0, y: 0 });
  let live = $state<string[]>([]);
  let pool = $state<string[]>([]);
  let loaded = $state(new Set<string>());
  let ready = $state(new Set<string>());
  const frameEls: Record<string, HTMLIFrameElement | undefined> = {};
  let queue: Promise<void> = Promise.resolve();

  const labels = $derived(labelMetrics(view.scale, 0));
  const imageOf = (key: string) => (snapshots ? snapshots[key]?.url : shots[key]);
  const cannotRender = (key: string) => failed.includes(key) || unrendered.includes(key);
  const mounted = $derived(new Set([...pool, ...retiring].filter((key) => !failed.includes(key))));
  const settle = settler(() => (settledView = view), SETTLE_MS);

  function fit() {
    view = fitView(bounds, viewport);
    touched = false;
  }

  $effect(() => {
    if (!touched && !fitted && viewport.w > 0) {
      view = fitView(bounds, viewport);
      fitted = true;
    }
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
    const keys = stale?.keys;
    if (!keys) {
      return;
    }
    untrack(() => {
      for (const key of keys) {
        if (!mounted.has(key)) {
          delete shots[key];
          continue;
        }
        setTimeout(() => void shoot(key), RECAPTURE_DELAY_MS);
      }
    });
  });

  $effect(() => {
    void view;
    settle();
  });

  $effect(() => {
    onview?.(view, viewport);
  });

  $effect(() => {
    const next = snapshots ? [] : liveSet(frames, settledView, viewport, untrack(() => live), minLiveWidth);
    if (next.join() !== untrack(() => live).join()) {
      live = next;
    }
  });

  function forget(key: string) {
    loaded = new Set([...loaded].filter((k) => k !== key));
    ready = new Set([...ready].filter((k) => k !== key));
  }

  function evict(key: string) {
    retiring = [...retiring, key];
    void shoot(key).finally(() => {
      retiring = retiring.filter((k) => k !== key);
      forget(key);
    });
  }

  $effect(() => {
    const plan = planPool({ pool: untrack(() => pool), wanted: live, settled: loaded, cap: POOL_CAP, maxLoading: MAX_LOADING });
    if (plan.pool.join() !== untrack(() => pool).join()) {
      pool = plan.pool;
    }
    plan.evicted.forEach(evict);
  });

  function settled(key: string) {
    if (!loaded.has(key)) {
      loaded = new Set([...loaded, key]);
    }
  }

  function onload(key: string) {
    settled(key);
    setTimeout(() => (ready = new Set([...ready, key])), PAINT_DELAY_MS);
    setTimeout(() => void shoot(key), FIRST_SHOT_DELAY_MS);
  }

  function register(node: HTMLIFrameElement, key: string) {
    frameEls[key] = node;
    const giveUp = setTimeout(() => settled(key), LOAD_TIMEOUT_MS);

    return { destroy: () => (clearTimeout(giveUp), delete frameEls[key]) };
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
    if (e.target instanceof HTMLInputElement) {
      return;
    }
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

  function onmessage(e: MessageEvent) {
    if (e.data?.type !== MOUNT_STATUS || e.data.status !== MOUNT_FAILED) {
      return;
    }
    const key = Object.keys(frameEls).find((k) => frameEls[k]?.contentWindow === e.source);
    if (key && !failed.includes(key)) {
      failed = [...failed, key];
    }
  }
</script>

<svelte:window {onkeydown} {onkeyup} {onmessage} onblur={() => (held = false)} />

<div
  class="canvas"
  role="application"
  aria-label={label}
  data-testid={testid}
  data-scale={view.scale}
  bind:this={root}
  bind:clientWidth={viewport.w}
  bind:clientHeight={viewport.h}
  use:attach
  onpointerdowncapture={press}
  style={`background-position:${view.x}px ${view.y}px`}
>
  <div class="world" style={`transform:translate(${view.x}px,${view.y}px) scale(${view.scale});--zoom:${view.scale};--label:${labels.font}px;--label-pad:${labels.pad}px`}>
    {@render world?.()}

    {#each frames as frame (frame.key)}
      {@const hit = hitOf(frame)}
      <div class="frame" style={`left:${frame.x}px;top:${frame.y}px;width:${frame.width}px;height:${frame.height}px`} data-testid="canvas-frame" data-key={frame.key} data-live={live.includes(frame.key)} data-rendered={!cannotRender(frame.key)} data-snap={Boolean(imageOf(frame.key))}>
        <span class="frame-label">{frameLabel(frame)}</span>
        {#if imageOf(frame.key)}<img class="shot" src={imageOf(frame.key)} alt="" draggable="false" />{:else}
          <div class="card">{@render card(frame, cannotRender(frame.key))}</div>
        {/if}
        {#if snapshots?.[frame.key]?.capped}<div class="more" data-testid="canvas-continues">continues…</div>{/if}
        {#if mounted.has(frame.key) && srcOf(frame) !== null}
          <iframe use:register={frame.key} src={srcOf(frame)!} title={frameLabel(frame)} tabindex="-1" data-ready={ready.has(frame.key)} class:shown={live.includes(frame.key) && ready.has(frame.key)} onload={() => onload(frame.key)} style={`width:${frame.width}px;height:${frame.height}px`}></iframe>
        {/if}
        <button type="button" class="hit" disabled={!hit.enabled} title={hit.title} aria-label={hit.label} data-testid="canvas-open" onclick={() => onopen(frame)}></button>
      </div>
    {/each}
  </div>

  {#if held}<div class="panner" class:grabbing={panning} data-testid="canvas-panner"></div>{/if}


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
    inset: var(--top-row) 0 0 0;
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
  }

  .frame {
    position: absolute;
    container-type: inline-size;
    background: var(--ui-panel);
    box-shadow: 0 0 0 calc(1px / var(--zoom)) var(--ui-divider);
  }

  .frame-label {
    position: absolute;
    bottom: 100%;
    left: 0;
    padding-bottom: var(--label-pad);
    color: var(--ui-text-2);
    font-size: var(--label);
    line-height: 1.25;
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
    visibility: hidden;
    opacity: 0;
    background: white;
  }

  iframe.shown {
    visibility: visible;
    opacity: 1;
    transition: opacity 160ms ease-out;
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
    font-size: min(calc(13px / var(--zoom)), 6cqw);
  }

  .card > :global(*) {
    max-width: 90%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .more {
    position: absolute;
    inset: auto 0 0 0;
    display: grid;
    align-items: end;
    justify-items: center;
    height: min(20%, 600px);
    padding-bottom: 1em;
    background: linear-gradient(transparent, var(--ui-panel));
    color: var(--ui-text-2);
    font-size: min(calc(13px / var(--zoom)), 6cqw);
    pointer-events: none;
  }

  .card :global(b) {
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

  .zoombar button:hover {
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
