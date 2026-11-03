<script lang="ts">
  import CompositionPlayer from './CompositionPlayer.svelte';
  import { framePicker } from '$lib/canvas/frame-pick';
  import type { LiveDoc } from '$lib/canvas/core/live-docs.svelte';
  import { hotspotsOf, isDrag, type Hotspot } from '$lib/motion/prototype/hotspots';
  import { TriggerKind } from '@feega/motion-core/motion/prototype/model';
  import { Background } from '@feega/motion-core/motion/doc';
  import { ElementState } from '@feega/motion-core/motion/states/model';
  import { StateSpotKind, stateHold, stateSpotsOf, type StateSpot } from '$lib/motion/states/spots';
  import { withStatedComps } from '$lib/motion/states/stated-comps';
  import { previewDoc, type StatePicks } from '$lib/motion/states/preview';
  import { amountAt, settled, type TweenRun } from '$lib/motion/states/tween';
  import { changeTo, clipById, variantHotspotsOf, withSwaps, type Swaps, type VariantHotspot } from '$lib/motion/prototype/variant-change';

  let { live, hint = false, interactive = true, background = Background.Brand, onfire, onrelease }: { live: LiveDoc; hint?: boolean; interactive?: boolean; background?: Background; onfire: (spot: Hotspot) => void; onrelease: (spot: Hotspot) => void } = $props();

  let swaps = $state<Swaps>({});
  let held = $state<Record<string, Swaps>>({});
  const current = $derived({ ...live, doc: withSwaps(live.doc, swaps) });
  const picker = $derived(framePicker(current, () => 0));
  const spots = $derived(hotspotsOf(current.doc, picker.frameSize(), (clip) => picker.frameRect(clip)));
  const variantSpots = $derived(interactive ? variantHotspotsOf(current.doc, picker.frameSize(), (path) => picker.pathRect(path)) : []);
  const percent = (fraction: number) => `${fraction * 100}%`;

  const stateSpots = $derived(interactive ? stateSpotsOf(current.doc, picker.frameSize(), (path) => picker.pathRect(path)) : []);
  let runs: Record<string, { state: ElementState; run: TweenRun }> = {};
  let statePicks = $state<StatePicks>({});
  let ticking = 0;
  const holding = $derived(Object.assign({}, ...Object.values(held)) as Swaps);
  const shown = $derived(previewDoc(Object.keys(holding).length ? withSwaps(withStatedComps(current.doc), holding) : current.doc, statePicks));

  function tick() {
    const now = performance.now();
    statePicks = Object.fromEntries(Object.entries(runs).map(([clip, { state: target, run }]) => [clip, { state: target, amount: amountAt(run, now) }]));
    runs = Object.fromEntries(Object.entries(runs).filter(([, { run }]) => !settled(run, now) || run.to > 0));
    ticking = Object.values(runs).some(({ run }) => !settled(run, now)) ? requestAnimationFrame(tick) : 0;
  }

  function tweenTo(clip: string, target: ElementState, to: number) {
    const row = clipRow(clip, target);
    if (!row) {
      return;
    }
    const from = statePicks[clip]?.state === target ? statePicks[clip].amount : 0;
    runs = { ...runs, [clip]: { state: target, run: { from, to, startedAt: performance.now(), transition: row.transition } } };
    if (!ticking) {
      ticking = requestAnimationFrame(tick);
    }
  }

  const clipRow = (clip: string, target: ElementState) => clipById(current.doc, clip)?.states?.find((r) => r.state === target);

  function hold(key: string, swapped: Swaps | null) {
    if (swapped) {
      held = { ...held, [key]: swapped };
    }
  }

  function release(key: string) {
    const { [key]: _released, ...rest } = held;
    held = rest;
  }

  const stateKey = (spot: StateSpot) => `state:${spot.path.join('/')}`;

  function stateEnter(spot: StateSpot, target: ElementState) {
    if (spot.kind === StateSpotKind.Rows) {
      tweenTo(spot.clip, target, 1);
      return;
    }
    hold(stateKey(spot), stateHold(current.doc, spot, target));
  }

  function stateLeave(spot: StateSpot) {
    if (spot.kind === StateSpotKind.Rows) {
      tweenTo(spot.clip, statePicks[spot.clip]?.state ?? ElementState.Hover, 0);
      return;
    }
    release(stateKey(spot));
  }

  const spotKey = (spot: VariantHotspot) => `${spot.path.join('/')}:${spot.interaction.id}`;

  function variantSwap(spot: VariantHotspot): Swaps | null {
    const picked = 'variant' in spot.interaction.action ? spot.interaction.action.variant : {};
    const swap = changeTo(current.doc, spot.path, picked);
    return swap ? { [swap.instance]: swap.comp } : null;
  }

  function variantClick(spot: VariantHotspot) {
    const swapped = spot.interaction.trigger.kind === TriggerKind.Click ? variantSwap(spot) : null;
    if (swapped) {
      swaps = { ...swaps, ...swapped };
    }
  }

  function variantEnter(spot: VariantHotspot) {
    if (spot.interaction.trigger.kind === TriggerKind.Hover) {
      hold(spotKey(spot), variantSwap(spot));
    }
  }

  const variantLeave = (spot: VariantHotspot) => release(spotKey(spot));

  let pressed: { id: string; x: number; y: number } | null = null;

  function down(e: PointerEvent, spot: Hotspot) {
    if (spot.interaction.trigger.kind === TriggerKind.Drag) {
      pressed = { id: spot.interaction.id, x: e.clientX, y: e.clientY };
    }
  }

  function move(e: PointerEvent, spot: Hotspot) {
    if (pressed?.id !== spot.interaction.id || !isDrag(e.clientX - pressed.x, e.clientY - pressed.y)) {
      return;
    }
    pressed = null;
    onfire(spot);
  }

  function click(spot: Hotspot) {
    if (spot.interaction.trigger.kind === TriggerKind.Click) {
      onfire(spot);
    }
  }

  function enter(spot: Hotspot) {
    if (spot.interaction.trigger.kind === TriggerKind.Hover) {
      onfire(spot);
    }
  }

  function leave(spot: Hotspot) {
    pressed = null;
    if (spot.interaction.trigger.kind === TriggerKind.Hover) {
      onrelease(spot);
    }
  }
</script>

<div class="view">
  <CompositionPlayer doc={shown} assets={live.assets} tokens={live.tokens} {background} />
  {#each stateSpots as spot (spot.path.join('/'))}
    <div
      class="state-spot"
      data-testid="state-spot"
      data-clip={spot.clip}
      role="presentation"
      style={`left:${percent(spot.box.left)};top:${percent(spot.box.top)};width:${percent(spot.box.width)};height:${percent(spot.box.height)}`}
      onpointerenter={() => stateEnter(spot, ElementState.Hover)}
      onpointerleave={() => stateLeave(spot)}
      onpointerdown={() => stateEnter(spot, ElementState.Pressed)}
      onpointerup={() => stateEnter(spot, ElementState.Hover)}
    ></div>
  {/each}
  {#each variantSpots as spot (spotKey(spot))}
    <button
      type="button"
      class="spot"
      class:hint
      data-testid="variant-spot"
      data-trigger={spot.interaction.trigger.kind}
      data-interaction={spot.interaction.id}
      aria-label={`Change to ${Object.values('variant' in spot.interaction.action ? spot.interaction.action.variant : {}).join(', ')}`}
      style={`left:${percent(spot.box.left)};top:${percent(spot.box.top)};width:${percent(spot.box.width)};height:${percent(spot.box.height)}`}
      onclick={() => variantClick(spot)}
      onpointerenter={() => variantEnter(spot)}
      onpointerleave={() => variantLeave(spot)}
    ></button>
  {/each}
  {#if interactive}
    {#each spots as spot (spot.interaction.id)}
      <button
        type="button"
        class="spot"
        class:hint
        data-trigger={spot.interaction.trigger.kind}
        data-interaction={spot.interaction.id}
        aria-label={`Prototype link ${spot.interaction.trigger.kind}`}
        style={`left:${percent(spot.box.left)};top:${percent(spot.box.top)};width:${percent(spot.box.width)};height:${percent(spot.box.height)}`}
        onclick={() => click(spot)}
        onpointerenter={() => enter(spot)}
        onpointerleave={() => leave(spot)}
        onpointerdown={(e) => down(e, spot)}
        onpointermove={(e) => move(e, spot)}
      ></button>
    {/each}
  {/if}
</div>

<style>
  .view {
    position: absolute;
    inset: 0;
    container-type: size;
  }

  .state-spot {
    position: absolute;
  }

  .spot {
    position: absolute;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    touch-action: none;
    border-radius: var(--ui-radius-sm, 4px);
    transition: background 200ms var(--ui-ease, ease), box-shadow 200ms var(--ui-ease, ease);
  }

  .spot.hint {
    background: color-mix(in srgb, var(--ui-accent, #0099ff) 18%, transparent);
    box-shadow: 0 0 0 2px var(--ui-accent, #0099ff);
  }
</style>
