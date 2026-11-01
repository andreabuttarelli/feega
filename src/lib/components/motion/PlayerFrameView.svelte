<script lang="ts">
  import CompositionPlayer from './CompositionPlayer.svelte';
  import { framePicker } from '$lib/canvas/frame-pick';
  import type { LiveDoc } from '$lib/canvas/core/live-docs.svelte';
  import { hotspotsOf, isDrag, type Hotspot } from '$lib/motion/prototype/hotspots';
  import { TriggerKind } from '@feega/motion-core/motion/prototype/model';
  import { ElementState } from '@feega/motion-core/motion/states/model';
  import { clipsOf } from '@feega/motion-core/motion/doc';
  import { stateSpotsOf } from '$lib/motion/states/spots';
  import { hasVariantStates } from '$lib/motion/states/variant-states';
  import { previewDoc, type StatePicks } from '$lib/motion/states/preview';
  import { amountAt, settled, type TweenRun } from '$lib/motion/states/tween';
  import { changeTo, variantHotspotsOf, withSwaps, type Swaps, type VariantHotspot } from '$lib/motion/prototype/variant-change';

  let { live, hint = false, interactive = true, onfire, onrelease }: { live: LiveDoc; hint?: boolean; interactive?: boolean; onfire: (spot: Hotspot) => void; onrelease: (spot: Hotspot) => void } = $props();

  let swaps = $state<Swaps>({});
  const current = $derived({ ...live, doc: withSwaps(live.doc, swaps) });
  const picker = $derived(framePicker(current, () => 0));
  const spots = $derived(hotspotsOf(current.doc, picker.frameSize(), (clip) => picker.frameRect(clip)));
  const variantSpots = $derived(interactive ? variantHotspotsOf(current.doc, picker.frameSize(), (path) => picker.pathRect(path)) : []);
  const percent = (fraction: number) => `${fraction * 100}%`;

  const stateSpots = $derived(interactive ? stateSpotsOf(current.doc, picker.frameSize(), (clip) => picker.frameRect(clip)) : []);
  let runs: Record<string, { state: ElementState; run: TweenRun }> = {};
  let statePicks = $state<StatePicks>({});
  let ticking = 0;
  const shown = $derived(previewDoc(current.doc, statePicks));
  let hoverSwaps: Record<string, Swaps> = {};

  function tick() {
    const now = performance.now();
    statePicks = Object.fromEntries(Object.entries(runs).map(([clip, { state: target, run }]) => [clip, { state: target, amount: amountAt(run, now) }]));
    runs = Object.fromEntries(Object.entries(runs).filter(([, { run }]) => !settled(run, now) || run.to > 0));
    ticking = Object.values(runs).some(({ run }) => !settled(run, now)) ? requestAnimationFrame(tick) : 0;
  }

  function tweenTo(clip: string, target: ElementState, to: number) {
    const row = clipRow(clip, target);
    if (!row && hasVariantStates(current.doc, clip)) {
      statePicks = { ...statePicks, [clip]: { state: target, amount: to } };
      return;
    }
    if (!row) {
      return;
    }
    const from = statePicks[clip]?.state === target ? statePicks[clip].amount : 0;
    runs = { ...runs, [clip]: { state: target, run: { from, to, startedAt: performance.now(), transition: row.transition } } };
    if (!ticking) {
      ticking = requestAnimationFrame(tick);
    }
  }

  const clipRow = (clip: string, target: ElementState) => clipsOf(current.doc).find((c) => c.id === clip)?.states?.find((r) => r.state === target);

  const spotKey = (spot: VariantHotspot) => `${spot.path.join('/')}:${spot.interaction.id}`;

  function changeVariant(spot: VariantHotspot): Swaps | null {
    const picked = 'variant' in spot.interaction.action ? spot.interaction.action.variant : {};
    const swap = changeTo(current.doc, spot.path, picked);
    if (!swap) {
      return null;
    }
    const before = { [swap.instance]: swaps[swap.instance] ?? '' };
    swaps = { ...swaps, [swap.instance]: swap.comp };
    return before;
  }

  function variantClick(spot: VariantHotspot) {
    if (spot.interaction.trigger.kind === TriggerKind.Click) {
      changeVariant(spot);
    }
  }

  function variantEnter(spot: VariantHotspot) {
    const before = spot.interaction.trigger.kind === TriggerKind.Hover ? changeVariant(spot) : null;
    if (before) {
      hoverSwaps = { ...hoverSwaps, [spotKey(spot)]: before };
    }
  }

  function variantLeave(spot: VariantHotspot) {
    const before = hoverSwaps[spotKey(spot)];
    if (!before) {
      return;
    }
    const { [spotKey(spot)]: _left, ...rest } = hoverSwaps;
    hoverSwaps = rest;
    swaps = Object.fromEntries(Object.entries({ ...swaps, ...before }).filter(([, comp]) => comp));
  }

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
  <CompositionPlayer doc={shown} assets={live.assets} tokens={live.tokens} />
  {#each stateSpots as spot (spot.clip)}
    <div
      class="state-spot"
      data-testid="state-spot"
      data-clip={spot.clip}
      role="presentation"
      style={`left:${percent(spot.box.left)};top:${percent(spot.box.top)};width:${percent(spot.box.width)};height:${percent(spot.box.height)}`}
      onpointerenter={() => tweenTo(spot.clip, ElementState.Hover, 1)}
      onpointerleave={() => tweenTo(spot.clip, statePicks[spot.clip]?.state ?? ElementState.Hover, 0)}
      onpointerdown={() => tweenTo(spot.clip, ElementState.Pressed, 1)}
      onpointerup={() => tweenTo(spot.clip, ElementState.Hover, 1)}
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
