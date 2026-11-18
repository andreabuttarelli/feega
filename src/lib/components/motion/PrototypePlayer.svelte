<script lang="ts" module>
  import type { LiveDoc } from '$lib/canvas/core/live-docs.svelte';

  export type PlayerFrame = { id: string; name: string; live: LiveDoc };
</script>

<script lang="ts">
  import { onMount, tick } from 'svelte';
  import PlayerFrameView from './PlayerFrameView.svelte';
  import { portalInto } from '$lib/components/brand-agent/right-bar-host.svelte';
  import { MoveKind, act, closeTopOverlay, linkOf, startPlayer, type Move, type PlayerState, type Step } from '$lib/motion/prototype/player';
  import { delayed, type Hotspot } from '$lib/motion/prototype/hotspots';
  import { flowsOf } from '$lib/motion/prototype/flows';
  import { transitionPlan } from '$lib/motion/prototype/transition-plan';
  import { ActionKind, DEFAULT_OVERLAY, TransitionKind, TriggerKind, type Overlay } from '@feega/motion-core/motion/prototype/model';
  import { Background } from '@feega/motion-core/motion/doc';
  import { overlayBox } from '$lib/motion/prototype/overlay-place';
  import { MODES, MODE_ORDER, ViewportMode, WidthSource, activeView, clampWidth, docAtWidth, frameBox, shownWidth, viewChoices, type Viewport } from '$lib/motion/prototype/viewport';
  import { readViewport, writeViewport } from '$lib/motion/prototype/viewport-pref';
  import { DEVICES, DEVICE_ORDER, Device, deviceForKey, pressedDevice } from '$lib/motion/prototype/device';
  import { IconButton, IconSize, Kbd, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Side } from '$lib/components/ui/shell';
  import Monitor from '@lucide/svelte/icons/monitor';
  import TabletIcon from '@lucide/svelte/icons/tablet';
  import Smartphone from '@lucide/svelte/icons/smartphone';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import X from '@lucide/svelte/icons/x';
  import Check from '@lucide/svelte/icons/check';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Maximize from '@lucide/svelte/icons/maximize-2';
  import Minimize from '@lucide/svelte/icons/minimize-2';

  let { frames, start: first, onclose }: { frames: PlayerFrame[]; start: string; onclose?: () => void } = $props();

  type Layer = { uid: number; frame: string; overlay: Overlay | null };

  const HINT_MS = 700;
  const STAGE_PAD_PX = 16;
  const EDGE_FACTOR_CENTERED = 2;
  const IDLE_MS = 2000;
  const DEVICE_ICON = { [Device.Desktop]: Monitor, [Device.Tablet]: TabletIcon, [Device.Phone]: Smartphone };

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
  let dragFrom = $state<{ x: number; width: number; side: number } | null>(null);
  let full = $state(false);
  let idle = $state(false);
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let root = $state<HTMLElement>();

  const responsive = $derived(view.mode === ViewportMode.Responsive);
  const width = $derived(shownWidth(view, stageW - STAGE_PAD_PX * 2));
  const liveOf = (id: string) => {
    const live = byId.get(id)?.live;
    return live && responsive ? { ...live, doc: docAtWidth(live.doc, width) } : live;
  };
  const baseFrame = $derived(byId.get(at.current));
  const baseLive = $derived(liveOf(at.current));
  const box = $derived(
    baseLive ? frameBox(view.mode, { w: stageW - STAGE_PAD_PX * 2, h: stageH - STAGE_PAD_PX }, { w: baseLive.doc.width, h: baseLive.doc.height }, width) : null
  );
  const framed = $derived(box ? box.w * box.scale < stageW - STAGE_PAD_PX * 2 : false);
  const pressed = $derived(responsive ? pressedDevice(view) : null);
  const flowStart = $derived(flows.find((f) => f.frame === start));
  const breakpoint = $derived(baseFrame ? activeView(baseFrame.live.doc, width) : null);
  const choices = $derived(baseFrame ? viewChoices(baseFrame.live.doc) : []);
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
    dragFrom = { x: e.clientX, width, side };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function drag(e: PointerEvent) {
    if (!dragFrom || !box) {
      return;
    }
    const factor = box.w * box.scale < stageW - STAGE_PAD_PX * 2 ? EDGE_FACTOR_CENTERED : 1;
    setView({ width: dragFrom.width + (dragFrom.side * (e.clientX - dragFrom.x) * factor) / box.scale, source: WidthSource.Fixed });
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
    const link = linkOf(spot.interaction.action);
    if (link) {
      window.open(link, '_blank', 'noopener,noreferrer');
      return;
    }
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

  function pickDevice(device: Device) {
    setView({ mode: ViewportMode.Responsive, width: DEVICES[device].width, source: WidthSource.Fixed });
  }

  function toggleFull() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void document.documentElement.requestFullscreen?.();
  }

  function wake() {
    idle = false;
    clearTimeout(idleTimer);
    if (full) {
      idleTimer = setTimeout(() => (idle = true), IDLE_MS);
    }
  }

  function onFullscreen() {
    full = Boolean(document.fullscreenElement);
    wake();
  }

  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }
    const device = deviceForKey(e.key);
    if (device) {
      pickDevice(device);
      return;
    }
    if (e.key === 'f' || e.key === 'F') {
      toggleFull();
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

  onMount(() => {
    root?.focus();
    return () => {
      clearTimeout(hintTimer);
      clearTimeout(idleTimer);
    };
  });
</script>

<svelte:window onpointermove={wake} />
<svelte:document onfullscreenchange={onFullscreen} />

<div class="player" class:full class:idle role="dialog" tabindex="-1" bind:this={root} onkeydown={onKey} aria-label="Prototype player" data-testid="prototype-player" use:portalInto={document.body}>
  <header class="bar">
    <div class="zone">
      {#if flows.length}
        <Menu>
          <MenuTrigger>
            {#snippet child({ props })}
              <button {...props} type="button" class="pill title" aria-label="Flow" data-testid="prototype-flow">
                <span class="name">{baseFrame?.name ?? ''}</span>
                {#if flowStart}<span class="sub">{flowStart.name}</span>{/if}
                <ChevronDown class="chev" />
              </button>
            {/snippet}
          </MenuTrigger>
          <MenuContent class="z-[1001]">
            <MenuLabel label="Flows" />
            {#each flows as flow (flow.frame)}
              <MenuItem label={flow.name} icon={flow.frame === start ? Check : undefined} onSelect={() => startAt(flow.frame)} />
            {/each}
          </MenuContent>
        </Menu>
      {:else}
        <span class="title name">{baseFrame?.name ?? ''}</span>
      {/if}
    </div>

    <div class="zone" role="toolbar" aria-label="Viewport" data-testid="prototype-viewport">
      <div class="group">
        {#each DEVICE_ORDER as device (device)}
          {@const Icon = DEVICE_ICON[device]}
          <IconButton label={DEVICES[device].label} shortcut={DEVICES[device].key} size={IconSize.Sm} side={Side.Bottom} pressed={pressed === device} data-testid={`device-${device}`} onclick={() => pickDevice(device)}><Icon /></IconButton>
        {/each}
        <span class="sep"></span>
        <label class="width">
          <input type="number" min="120" max="4096" aria-label="Width in pixels" data-testid="viewport-width" value={width} onchange={(e) => setView({ mode: ViewportMode.Responsive, width: e.currentTarget.valueAsNumber, source: WidthSource.Fixed })} />
          <span>px</span>
        </label>
        <Menu>
          <MenuTrigger>
            {#snippet child({ props })}
              <button {...props} type="button" class="pill" aria-label="Views" data-testid="viewport-menu">
                <span data-testid="viewport-readout">{view.source === WidthSource.Window ? `Window · ${breakpoint?.name}` : breakpoint?.name}</span>
                <ChevronDown class="chev" />
              </button>
            {/snippet}
          </MenuTrigger>
          <MenuContent class="z-[1001]" align="center">
            <MenuItem label="Follow window" icon={responsive && view.source === WidthSource.Window ? Check : undefined} data-testid="viewport-window" onSelect={() => setView({ mode: ViewportMode.Responsive, source: WidthSource.Window })} />
            <MenuSeparator />
            <MenuLabel label="Views" />
            {#each choices as choice (choice.width)}
              <MenuItem label={`${choice.label} · ${choice.width}`} icon={responsive && view.source === WidthSource.Fixed && view.width === choice.width ? Check : undefined} data-testid={`viewport-${choice.width}`} onSelect={() => setView({ mode: ViewportMode.Responsive, width: choice.width, source: WidthSource.Fixed })} />
            {/each}
          </MenuContent>
        </Menu>
      </div>
    </div>

    <div class="zone end">
      <IconButton label="Restart" shortcut="R" size={IconSize.Sm} side={Side.Bottom} data-testid="prototype-restart" onclick={restart}><RotateCcw /></IconButton>
      <Menu>
        <MenuTrigger>
          {#snippet child({ props })}
            <button {...props} type="button" class="pill" aria-label="Zoom" data-testid="viewport-zoom">
              <span>{box ? `${Math.round(box.scale * 100)}%` : MODES[view.mode].label}</span>
              <ChevronDown class="chev" />
            </button>
          {/snippet}
        </MenuTrigger>
        <MenuContent class="z-[1001]" align="end">
          {#each MODE_ORDER as mode (mode)}
            <MenuItem label={MODES[mode].label} icon={view.mode === mode ? Check : undefined} data-testid={`viewport-${mode}`} onSelect={() => setView({ mode })} />
          {/each}
        </MenuContent>
      </Menu>
      <IconButton label={full ? 'Exit full screen' : 'Full screen'} shortcut="F" size={IconSize.Sm} side={Side.Bottom} data-testid="prototype-fullscreen" onclick={toggleFull}>
        {#if full}<Minimize />{:else}<Maximize />{/if}
      </IconButton>
      {#if onclose}
        <span class="sep"></span>
        <IconButton label="Close" shortcut="Escape" size={IconSize.Sm} side={Side.Bottom} data-testid="prototype-close" onclick={onclose}><X /></IconButton>
      {/if}
    </div>
  </header>
  <div class="stage" class:scrolls={box?.scrolls} role="presentation" bind:clientWidth={stageW} bind:clientHeight={stageH} onpointerdown={showHints}>
    {#if box}
      <div class="sizer" class:framed class:dragging={dragFrom} style={`width:${box.w * box.scale}px;height:${box.h * box.scale}px`}>
        <div class="viewport" data-frame={at.current} style={`width:${box.w}px;height:${box.h}px;transform:scale(${box.scale});--scale:${box.scale}`}>
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
            <div class="handle" style={side < 0 ? 'left:-16px' : 'right:-16px'} role="separator" aria-orientation="vertical" aria-label="Resize width" data-testid="viewport-handle" onpointerdown={(e) => grab(e, side)} onpointermove={drag} onpointerup={drop} onpointercancel={drop}></div>
          {/each}
          {#if dragFrom}
            <span class="live-width" data-testid="viewport-live-width">{width} px · {breakpoint?.name}</span>
          {/if}
        {/if}
      </div>
    {/if}
  </div>
  {#if onclose}
    <span class="esc" aria-hidden="true"><Kbd shortcut="Escape" /> to close</span>
  {/if}
</div>

<style>
  .player {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    background: var(--ui-canvas);
    color: var(--ui-text);
    font-size: var(--ui-text-md);
    outline: none;
  }

  :global(body:has([data-testid='prototype-player']) [data-slot='hint'][data-slot='hint']) {
    z-index: 1001;
  }

  .bar {
    flex: none;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 12px;
    height: 48px;
    padding: 0 8px 0 16px;
    background: var(--ui-panel);
    border-bottom: 1px solid var(--ui-divider);
    transition:
      transform 200ms var(--ease-expo-out, ease),
      opacity 200ms ease;
  }

  .full .bar {
    position: absolute;
    inset: 0 0 auto;
    z-index: 2;
    box-shadow: var(--ui-shadow-float);
  }

  .full.idle .bar {
    transform: translateY(-100%);
    opacity: 0;
    pointer-events: none;
  }

  .full.idle {
    cursor: none;
  }

  .zone {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .end {
    justify-content: flex-end;
  }

  .title {
    font-weight: 600;
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sub {
    color: var(--ui-text-secondary);
    font-weight: 400;
  }

  .group {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
  }

  .sep {
    width: 1px;
    height: 16px;
    margin: 0 4px;
    background: var(--ui-divider-strong);
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    height: 28px;
    padding: 0 6px 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: var(--ui-text-sm);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    cursor: pointer;
  }

  .pill:hover,
  .pill[aria-expanded='true'] {
    background: var(--ui-wash);
  }

  .pill.title {
    margin-left: -8px;
    font-size: var(--ui-text-md);
  }

  .pill :global(.chev) {
    flex: none;
    width: 14px;
    height: 14px;
    color: var(--ui-text-secondary);
  }

  .width {
    display: flex;
    align-items: center;
    height: 28px;
    padding-right: 6px;
    border-radius: var(--ui-radius-sm);
    color: var(--ui-text-secondary);
    font-size: var(--ui-text-sm);
  }

  .width:hover {
    background: var(--ui-wash);
  }

  .width:focus-within {
    background: var(--ui-panel);
    box-shadow: inset 0 0 0 1px var(--ui-mode-solid);
  }

  .width input {
    width: 40px;
    height: 28px;
    padding: 0 3px 0 6px;
    border: 0;
    background: transparent;
    color: var(--ui-text);
    font: inherit;
    font-variant-numeric: tabular-nums;
    text-align: right;
    outline: none;
    appearance: textfield;
  }

  .width input::-webkit-inner-spin-button,
  .width input::-webkit-outer-spin-button {
    appearance: none;
    margin: 0;
  }

  .stage {
    flex: 1;
    min-height: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 16px;
    overflow: hidden;
    touch-action: pan-x pan-y pinch-zoom;
  }

  .full .stage {
    padding-top: 64px;
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
  }

  .sizer.framed {
    border-radius: var(--ui-radius-md);
    box-shadow: var(--ui-shadow-float);
  }

  .framed .viewport {
    border-radius: calc(var(--ui-radius-md) / var(--scale, 1));
  }

  .handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 16px;
    cursor: ew-resize;
    touch-action: none;
  }

  .handle::after {
    content: '';
    position: sticky;
    top: calc(50vh - 48px);
    display: block;
    width: 4px;
    height: 40px;
    margin: min(calc(50vh - 48px), calc(50% - 20px)) auto 0;
    border-radius: var(--ui-radius-full);
    background: var(--ui-divider-strong);
    transition:
      background 150ms ease,
      height 150ms ease;
  }

  .handle:hover::after,
  .dragging .handle::after {
    height: 56px;
    background: var(--ui-mode-solid);
  }

  .live-width {
    position: absolute;
    top: 12px;
    left: 50%;
    z-index: 3;
    transform: translateX(-50%);
    padding: 4px 8px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-tooltip);
    color: var(--ui-tooltip-ink);
    font-size: var(--ui-text-sm);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    box-shadow: var(--ui-shadow-raised);
    pointer-events: none;
  }

  .esc {
    position: absolute;
    right: 16px;
    bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
    pointer-events: none;
    transition: opacity 200ms ease;
  }

  .full.idle .esc {
    opacity: 0;
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
