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
  import { ActionKind, TransitionKind, TriggerKind } from '@feega/motion-core/motion/prototype/model';

  let { frames, start: first, onclose }: { frames: PlayerFrame[]; start: string; onclose?: () => void } = $props();

  type Layer = { uid: number; frame: string; overlay: boolean };

  const HINT_MS = 700;
  const OVERLAY_SHARE = 0.8;

  const byId = $derived(new Map(frames.map((f) => [f.id, f])));
  const known = $derived(new Set(frames.map((f) => f.id)));
  const docs = $derived(new Map(frames.map((f) => [f.id, f.live.doc])));
  const flows = $derived(flowsOf(docs, frames.map((f) => f.id)));

  let seed = 0;
  let start = $state(first);
  let at = $state<PlayerState>(startPlayer(first));
  let layers = $state<Layer[]>([{ uid: ++seed, frame: first, overlay: false }]);
  let busy = $state(false);
  let hint = $state(false);
  let hoverUndo: string | null = null;
  let hintTimer: ReturnType<typeof setTimeout> | undefined;
  const elements = new Map<number, HTMLElement>();

  const baseFrame = $derived(byId.get(at.current));
  const ratioOf = (id: string) => {
    const doc = byId.get(id)?.live.doc;
    return doc ? doc.width / doc.height : 1;
  };
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
      const next: Layer = { uid: ++seed, frame: move.to, overlay: true };
      layers = [...layers, next];
      await tick();
      await finish([play(next.uid, plan.incoming as Keyframe[], plan)]);
    } else {
      const previous = layers.find((l) => !l.overlay);
      const next: Layer = { uid: ++seed, frame: move.to, overlay: false };
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
    layers = [{ uid: ++seed, frame: start, overlay: false }];
  }

  function startAt(frame: string) {
    start = frame;
    busy = false;
    restart();
  }

  function showHints() {
    hint = true;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => (hint = false), HINT_MS);
  }

  function onKey(e: KeyboardEvent) {
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
  <div class="stage" role="presentation" onpointerdown={showHints}>
    <div class="viewport" data-frame={at.current} style={`--ratio:${ratioOf(at.current)}`}>
      {#each layers as layer (layer.uid)}
        {@const frame = byId.get(layer.frame)}
        {#if frame && !layer.overlay}
          <div class="layer" use:register={layer.uid}>
            <PlayerFrameView live={frame.live} {hint} interactive={!busy && layer.frame === at.current && !at.overlays.length} onfire={fire} onrelease={release} />
          </div>
        {:else if frame}
          <div class="scrim">
            <button type="button" class="dismiss" aria-label="Close overlay" onclick={() => apply(closeTopOverlay(at))}></button>
            <div class="sheet" use:register={layer.uid} style={`--ratio:${ratioOf(layer.frame)};--share:${OVERLAY_SHARE}`}>
              <PlayerFrameView live={frame.live} {hint} interactive={!busy && layer.frame === topFrameId} onfire={fire} onrelease={release} />
            </div>
          </div>
        {/if}
      {/each}
    </div>
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

  .stage {
    flex: 1;
    min-height: 0;
    display: grid;
    place-items: center;
    container-type: size;
    padding: 0 16px 16px;
  }

  .viewport {
    position: relative;
    width: min(100cqw, calc(100cqh * var(--ratio)));
    aspect-ratio: var(--ratio);
    overflow: hidden;
    background: #000;
  }

  .layer,
  .scrim {
    position: absolute;
    inset: 0;
  }

  .scrim {
    display: grid;
    place-items: center;
    container-type: size;
    background: rgb(0 0 0 / 0.45);
  }

  .dismiss {
    position: absolute;
    inset: 0;
    border: 0;
    background: transparent;
    cursor: default;
  }

  .sheet {
    position: relative;
    width: min(calc(100cqw * var(--share)), calc(100cqh * var(--share) * var(--ratio)));
    aspect-ratio: var(--ratio);
    overflow: hidden;
    border-radius: var(--ui-radius-lg, 10px);
  }
</style>
