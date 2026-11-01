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

  let { live, hint = false, interactive = true, onfire, onrelease }: { live: LiveDoc; hint?: boolean; interactive?: boolean; onfire: (spot: Hotspot) => void; onrelease: (spot: Hotspot) => void } = $props();

  const picker = $derived(framePicker(live, () => 0));
  const spots = $derived(hotspotsOf(live.doc, picker.frameSize(), (clip) => picker.frameRect(clip)));
  const percent = (fraction: number) => `${fraction * 100}%`;

  const stateSpots = $derived(interactive ? stateSpotsOf(live.doc, picker.frameSize(), (clip) => picker.frameRect(clip)) : []);
  let runs: Record<string, { state: ElementState; run: TweenRun }> = {};
  let statePicks = $state<StatePicks>({});
  let ticking = 0;
  const shown = $derived(previewDoc(live.doc, statePicks));

  function tick() {
    const now = performance.now();
    statePicks = Object.fromEntries(Object.entries(runs).map(([clip, { state: target, run }]) => [clip, { state: target, amount: amountAt(run, now) }]));
    runs = Object.fromEntries(Object.entries(runs).filter(([, { run }]) => !settled(run, now) || run.to > 0));
    ticking = Object.values(runs).some(({ run }) => !settled(run, now)) ? requestAnimationFrame(tick) : 0;
  }

  function tweenTo(clip: string, target: ElementState, to: number) {
    const row = clipRow(clip, target);
    if (!row && hasVariantStates(live.doc, clip)) {
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

  const clipRow = (clip: string, target: ElementState) => clipsOf(live.doc).find((c) => c.id === clip)?.states?.find((r) => r.state === target);

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
