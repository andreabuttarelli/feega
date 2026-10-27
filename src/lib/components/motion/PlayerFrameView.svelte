<script lang="ts">
  import CompositionPlayer from './CompositionPlayer.svelte';
  import { framePicker } from '$lib/canvas/frame-pick';
  import type { LiveDoc } from '$lib/canvas/core/live-docs.svelte';
  import { hotspotsOf, isDrag, type Hotspot } from '$lib/motion/prototype/hotspots';
  import { TriggerKind } from '@feega/motion-core/motion/prototype/model';

  let { live, hint = false, interactive = true, onfire, onrelease }: { live: LiveDoc; hint?: boolean; interactive?: boolean; onfire: (spot: Hotspot) => void; onrelease: (spot: Hotspot) => void } = $props();

  const picker = $derived(framePicker(live, () => 0));
  const spots = $derived(hotspotsOf(live.doc, picker.frameSize(), (clip) => picker.frameRect(clip)));
  const percent = (fraction: number) => `${fraction * 100}%`;

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
  <CompositionPlayer doc={live.doc} assets={live.assets} tokens={live.tokens} />
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
