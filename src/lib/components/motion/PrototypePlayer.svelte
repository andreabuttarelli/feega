<script lang="ts" module>
  import type { LiveDoc } from '$lib/canvas/core/live-docs.svelte';

  export type PlayerFrame = { id: string; name: string; live: LiveDoc };
</script>

<script lang="ts">
  import { onMount, tick } from 'svelte';
  import PlayerFrameView from './PlayerFrameView.svelte';
  import { portalInto } from '$lib/components/brand-agent/right-bar-host.svelte';
  import { MoveKind, act, closeTopOverlay, startPlayer, type Move, type PlayerState, type Step } from '$lib/motion/prototype/player';
  import { delayed, type Hotspot } from '$lib/motion/prototype/hotspots';
  import { flowsOf } from '$lib/motion/prototype/flows';
  import { transitionPlan } from '$lib/motion/prototype/transition-plan';
  import { ActionKind, DEFAULT_OVERLAY, TransitionKind, TriggerKind, type Overlay } from '@feega/motion-core/motion/prototype/model';
  import { Background } from '@feega/motion-core/motion/doc';
  import { overlayBox } from '$lib/motion/prototype/overlay-place';
  import { MODES, MODE_ORDER, WIDTH_PRESETS, ViewportMode, activeView, clampWidth, docAtWidth, frameBox, type Viewport } from '$lib/motion/prototype/viewport';
  import { readViewport, writeViewport } from '$lib/motion/prototype/viewport-pref';

  let { frames, start: first, onclose }: { frames: PlayerFrame[]; start: string; onclose?: () => void } = $props();

  type Layer = { uid: number; frame: string; overlay: Overlay | null };

  const HINT_MS = 700;
  const STAGE_PAD_PX = 16;
  const EDGE_FACTOR_CENTERED = 2;

  const byId = $derived(new Map(frames.map((f) => [f.id, f])));
  const known = $derived(new Set(frames.map((f) => f.id)));
  const docs = $derived(new Map(frames.map((f) => [f.id, f.live.doc])));
  const flows = $derived(flowsOf(docs, frames.map((f) => f.id)));

  let seed = 0;
  let start = $state(first);
  let at = $state<PlayerState>(startPlayer(first));
  let layers = $state<Layer[]>([{ uid: ++seed, frame: first, overlay: null }]);
  let busy = $state(false);
  let hint = $state(false);
  let hoverUndo: string | null = null;
  let hintTimer: ReturnType<typeof setTimeout> | undefined;
  const elements = new Map<number, HTMLElement>();

  let view = $state<Viewport>(readViewport(first));
  let stageW = $state(0);
  let stageH = $state(0);
  let dragFrom: { x: number; width: number; side: number } | null = null;

  const responsive = $derived(view.mode === ViewportMode.Responsive);
  const liveOf = (id: string) => {
    const live = byId.get(id)?.live;
    return live && responsive ? { ...live, doc: docAtWidth(live.doc, view.width) } : live;
  };
  const baseFrame = $derived(byId.get(at.current));
  const baseLive = $derived(liveOf(at.current));
  const box = $derived(
    baseLive ? frameBox(view.mode, { w: stageW - STAGE_PAD_PX * 2, h: stageH - STAGE_PAD_PX }, { w: baseLive.doc.width, h: baseLive.doc.height }, view.width) : null
  );
  const breakpoint = $derived(baseFrame ? activeView(baseFrame.live.doc, view.width) : null);
  const percent = (fraction: number) => `${fraction * 100}%`;
  const sheetStyle = (id: string, overlay: Overlay) => {
    const sheet = liveOf(id)?.doc;
    if (!sheet || !baseLive) {
      return '';
    }
    const at = overlayBox(baseLive.doc, sheet, overlay);
    return `left:${percent(at.left)};top:${percent(at.top)};width:${percent(at.width)};height:${percent(at.height)}`;
  };

  function setView(next: Partial<Viewport>) {
    view = { ...view, ...next, width: clampWidth(next.width ?? view.width) };
    writeViewport(start, view);
  }

  function grab(e: PointerEvent & { currentTarget: HTMLElement }, side: number) {
    dragFrom = { x: e.clientX, width: view.width, side };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function drag(e: PointerEvent) {
    if (!dragFrom || !box) {
      return;
    }
    const factor = box.w * box.scale < stageW - STAGE_PAD_PX * 2 ? EDGE_FACTOR_CENTERED : 1;
    setView({ width: dragFrom.width + (dragFrom.side * (e.clientX - dragFrom.x) * factor) / box.scale });
  }

  const drop = () => (dragFrom = null);
  const topFrameId = $derived(at.overlays.at(-1) ?? at.current);

  function register(node: HTMLElement, uid: number) {
    elements.set(uid, node);
    return { destroy: () => elements.delete(uid) };
  }

  const finish = (animations: (Animation | null)[]) => Promise.all(animations.map((a) => a?.finished.catch(() => null)));

  function play(uid: number, frames: Keyframe[], plan: ReturnType<typeof transitionPlan>, reverse = false): Animation | null {
    const node = elements.get(uid);
    return node && frames.length ? node.animate(frames, { duration: plan.durationMs, easing: plan.easing, fill: 'both', direction: reverse ? 'reverse' : 'normal' }) : null;
  }

  async function run(move: Move) {
    const plan = transitionPlan(move.transition, move.reverse);
    busy = true;
    if (move.kind === MoveKind.Close) {
      const top = layers.findLast((l) => l.overlay);
      if (top) {
        await finish([play(top.uid, plan.incoming as Keyframe[], plan, true)]);
        layers = layers.filter((l) => l.uid !== top.uid);
      }
    } else if (move.kind === MoveKind.Open) {
      const next: Layer = { uid: ++seed, frame: move.to, overlay: move.overlay ?? DEFAULT_OVERLAY };
      layers = [...layers, next];
      await tick();
      await finish([play(next.uid, plan.incoming as Keyframe[], plan)]);
    } else {
      const previous = layers.find((l) => !l.overlay);
      const next: Layer = { uid: ++seed, frame: move.to, overlay: null };
      layers = [...layers.filter((l) => !l.overlay), next];
      await tick();
      await finish([play(next.uid, plan.incoming as Keyframe[], plan), previous ? play(previous.uid, plan.outgoing as Keyframe[], plan) : null]);
      layers = [next];
    }
    busy = false;
  }

  function apply(step: Step) {
    if (!step.move || busy) {
      return false;
    }
    at = step.state;
    void run(step.move);
    return true;
  }

  function fire(spot: Hotspot) {
    const fired = apply(act(at, spot.interaction.action, spot.interaction.transition, known));
    hoverUndo = fired && spot.interaction.trigger.kind === TriggerKind.Hover ? spot.interaction.id : null;
  }

  function release(spot: Hotspot) {
    if (hoverUndo !== spot.interaction.id) {
      return;
    }
    hoverUndo = null;
    apply(backStep());
  }

  function backStep(): Step {
    return act(at, { kind: ActionKind.Back }, { kind: TransitionKind.Instant }, known);
  }

  function restart() {
    if (busy) {
      return;
    }
    at = startPlayer(start);
    layers = [{ uid: ++seed, frame: start, overlay: null }];
  }

  function startAt(frame: string) {
    start = frame;
    view = readViewport(frame);
    busy = false;
    restart();
  }

  function showHints() {
    hint = true;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => (hint = false), HINT_MS);
  }

  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) {
      return;
    }
    if (e.key === 'Escape') {
      if (at.overlays.length) {
        apply(closeTopOverlay(at));
        return;
      }
      onclose?.();
    } else if (e.key === 'r' || e.key === 'R') {
      restart();
    }
  }

  $effect(() => {
    const frame = topFrameId;
    const doc = byId.get(frame)?.live.doc;
    if (!doc) {
      return;
    }
    const timers = delayed(doc).map(({ interaction, delayMs }) =>
      setTimeout(() => apply(act(at, interaction.action, interaction.transition, known)), delayMs)
    );
    return () => timers.forEach(clearTimeout);
  });

  onMount(() => () => clearTimeout(hintTimer));
</script>

<svelte:window onkeydown={onKey} />

<div class="player" role="dialog" aria-label="Prototype player" data-testid="prototype-player" use:portalInto={document.body}>
  <header class="bar">
    <span class="title">{baseFrame?.name ?? ''}
      {#if flows.length}
        <select class="flow" aria-label="Flow" data-testid="prototype-flow" value={flows.some((f) => f.frame === start) ? start : ''} onchange={(e) => e.currentTarget.value && startAt(e.currentTarget.value)}>
          {#if !flows.some((f) => f.frame === start)}<option value="">Flows</option>{/if}
          {#each flows as flow (flow.frame)}<option value={flow.frame}>{flow.name}</option>{/each}
        </select>
      {/if}
    </span>
    <span class="actions">
      <button type="button" onclick={restart} data-testid="prototype-restart">Restart</button>
      {#if onclose}<button type="button" onclick={onclose} data-testid="prototype-close">Close</button>{/if}
    </span>
  </header>
  <div class="views" role="toolbar" aria-label="Viewport" data-testid="prototype-viewport">
    <span class="seg">
      {#each MODE_ORDER as mode (mode)}
        <button type="button" class:on={view.mode === mode} aria-pressed={view.mode === mode} data-testid={`viewport-${mode}`} onclick={() => setView({ mode })}>{MODES[mode].label}</button>
      {/each}
    </span>
    {#if responsive}
      <span class="seg">
        {#each WIDTH_PRESETS as preset (preset.label)}
          <button type="button" class:on={view.width === preset.width} data-testid={`viewport-${preset.label.toLowerCase()}`} onclick={() => setView({ width: preset.width })}>{preset.label} {preset.width}</button>
        {/each}
      </span>
      <label class="width">
        <input type="number" min="120" max="4096" aria-label="Width in pixels" data-testid="viewport-width" value={view.width} onchange={(e) => setView({ width: e.currentTarget.valueAsNumber })} />
        <span>px</span>
      </label>
      <span class="readout" data-testid="viewport-readout">{view.width} px · {breakpoint?.name}</span>
    {/if}
  </div>
  <div class="stage" class:scrolls={box?.scrolls} role="presentation" bind:clientWidth={stageW} bind:clientHeight={stageH} onpointerdown={showHints}>
    {#if box}
      <div class="sizer" style={`width:${box.w * box.scale}px;height:${box.h * box.scale}px`}>
        <div class="viewport" data-frame={at.current} style={`width:${box.w}px;height:${box.h}px;transform:scale(${box.scale})`}>
          {#each layers as layer (layer.uid)}
            {@const frame = liveOf(layer.frame)}
            {#if frame && !layer.overlay}
              <div class="layer" use:register={layer.uid}>
                <PlayerFrameView live={frame} {hint} interactive={!busy && layer.frame === at.current && !at.overlays.length} onfire={fire} onrelease={release} />
              </div>
            {:else if frame && layer.overlay}
              <div class="scrim" style:background={layer.overlay.backdrop} data-testid="prototype-scrim">
                {#if layer.overlay.closeOutside}
                  <button type="button" class="dismiss" aria-label="Close overlay" data-testid="prototype-dismiss" onclick={() => apply(closeTopOverlay(at))}></button>
                {/if}
                <div class="sheet" use:register={layer.uid} data-testid="prototype-sheet" style={sheetStyle(layer.frame, layer.overlay)}>
                  <PlayerFrameView live={frame} {hint} background={Background.Transparent} interactive={!busy && layer.frame === topFrameId} onfire={fire} onrelease={release} />
                </div>
              </div>
            {/if}
          {/each}
        </div>
        {#if responsive}
          {#each [-1, 1] as side (side)}
            <div class="handle" style={side < 0 ? 'left:-12px' : 'right:-12px'} role="separator" aria-orientation="vertical" aria-label="Resize width" data-testid="viewport-handle" onpointerdown={(e) => grab(e, side)} onpointermove={drag} onpointerup={drop} onpointercancel={drop}></div>
          {/each}
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .player {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    background: #0d0d0d;
    color: #f2f2f2;
  }

  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    height: var(--ui-bar-h, 48px);
    padding: 0 16px;
    font-size: 13px;
  }

  .title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
  }

  .flow {
    padding: 2px 8px;
    border: 0;
    border-radius: var(--ui-radius-full, 999px);
    background: rgb(255 255 255 / 0.12);
    color: inherit;
    font-size: 11px;
    font-weight: 500;
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  button {
    font: inherit;
  }

  .actions button {
    height: 28px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--ui-radius-sm, 4px);
    background: rgb(255 255 255 / 0.12);
    color: inherit;
    cursor: pointer;
  }

  .views {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0 16px 8px;
    font-size: 11px;
  }

  .seg {
    display: flex;
    gap: 2px;
    padding: 2px;
    border-radius: var(--ui-radius-sm, 4px);
    background: rgb(255 255 255 / 0.08);
  }

  .seg button {
    height: 22px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-xs, 2px);
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .seg button.on {
    background: rgb(255 255 255 / 0.18);
  }

  .width {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .width input {
    width: 64px;
    height: 22px;
    padding: 0 6px;
    border: 0;
    border-radius: var(--ui-radius-sm, 4px);
    background: rgb(255 255 255 / 0.12);
    color: inherit;
    font: inherit;
  }

  .readout {
    opacity: 0.7;
    font-variant-numeric: tabular-nums;
  }

  .stage {
    flex: 1;
    min-height: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0 16px 16px;
    overflow: hidden;
    touch-action: pan-x pan-y pinch-zoom;
  }

  .stage.scrolls {
    align-items: flex-start;
    overflow: auto;
    overscroll-behavior: contain;
  }

  .sizer {
    position: relative;
    flex: none;
  }

  .viewport {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: 0 0;
    overflow: hidden;
    background: #000;
  }

  .handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 12px;
    display: grid;
    place-items: center;
    cursor: ew-resize;
    touch-action: none;
  }

  .handle::after {
    content: '';
    width: 4px;
    height: 32px;
    border-radius: var(--ui-radius-full, 999px);
    background: rgb(255 255 255 / 0.4);
  }

  .layer,
  .scrim {
    position: absolute;
    inset: 0;
  }

  .scrim {
    container-type: size;
  }

  .dismiss {
    position: absolute;
    inset: 0;
    border: 0;
    background: transparent;
    cursor: default;
  }

  .sheet {
    position: absolute;
  }
</style>
