<script lang="ts">
  import { HandlePhase } from '@feega/plugin-api/protocol';
  import type { Pick } from '../messages';
  import type { Plugins } from './plugins.svelte';

  type Props = { plugins: Plugins; picked: Pick; scale: number };

  let { plugins, picked, scale }: Props = $props();

  let dragging = $state<string | null>(null);

  const places = $derived(
    plugins.overlays.flatMap((one) => plugins.handles(one.plugin, one.entry.id).map((handle) => ({ plugin: one.plugin, overlay: one.entry.id, handle })))
  );

  const unit = (v: number) => Math.min(1, Math.max(0, v));

  function fraction(e: PointerEvent) {
    const stage = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect();
    const { rect } = picked;
    return { x: unit(((e.clientX - stage.left) / scale - rect.x) / rect.width), y: unit(((e.clientY - stage.top) / scale - rect.y) / rect.height) };
  }

  function send(place: (typeof places)[number], phase: HandlePhase, e: PointerEvent) {
    const { x, y } = fraction(e);
    plugins.host.handle(place.plugin, place.overlay, place.handle.id, phase, x, y);
  }

  function press(place: (typeof places)[number], e: PointerEvent) {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging = place.handle.id;
    send(place, HandlePhase.Press, e);
  }

  function move(place: (typeof places)[number], e: PointerEvent) {
    if (dragging === place.handle.id) {
      send(place, HandlePhase.Move, e);
    }
  }

  function release(place: (typeof places)[number], e: PointerEvent) {
    if (dragging === place.handle.id) {
      dragging = null;
      send(place, HandlePhase.Release, e);
    }
  }
</script>

{#each places as place (place.plugin + place.overlay + place.handle.id)}
  <button
    type="button"
    class="handle"
    class:selected={place.handle.selected}
    data-testid="plugin-handle"
    data-handle={place.handle.id}
    aria-label={`Move point ${place.handle.id}`}
    style={`left:${(picked.rect.x + place.handle.x * picked.rect.width) * scale}px;top:${(picked.rect.y + place.handle.y * picked.rect.height) * scale}px;background:${place.handle.color}`}
    onpointerdown={(e) => press(place, e)}
    onpointermove={(e) => move(place, e)}
    onpointerup={(e) => release(place, e)}
    onclick={(e) => e.stopPropagation()}
  ></button>
{/each}

<style>
  .handle {
    position: absolute;
    box-sizing: border-box;
    width: 18px;
    height: 18px;
    margin: -9px 0 0 -9px;
    padding: 0;
    border: 2px solid #fff;
    border-radius: 50%;
    box-shadow: 0 0 0 1px rgb(0 0 0 / 0.45), 0 2px 6px rgb(0 0 0 / 0.35);
    cursor: grab;
    touch-action: none;
  }

  .handle.selected {
    width: 22px;
    height: 22px;
    margin: -11px 0 0 -11px;
    box-shadow: 0 0 0 2px var(--ui-accent), 0 2px 6px rgb(0 0 0 / 0.35);
  }

  .handle:active {
    cursor: grabbing;
  }
</style>
