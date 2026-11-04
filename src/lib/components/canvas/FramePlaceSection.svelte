<script lang="ts">
  import NumberField from '$lib/components/motion/NumberField.svelte';
  import AlignBar from '$lib/components/motion/AlignBar.svelte';
  import FlipHorizontal from '@lucide/svelte/icons/flip-horizontal-2';
  import FlipVertical from '@lucide/svelte/icons/flip-vertical-2';
  import { FieldKind } from '$lib/motion/number-field';
  import { Flip } from '$lib/motion/layer-props';
  import type { NodePlace } from './frame-properties.svelte';

  let { place }: { place: NodePlace } = $props();

  const TURN_RANGE = { min: -360, max: 360, step: 1 };
  const RANGE = { min: -1_000_000, max: 1_000_000, step: 1 };
  const ICON = 14;
  const ONE_LAYER = 1;
</script>

<fieldset class="align" disabled={!place.align} data-testid="frame-align">
  <AlignBar count={ONE_LAYER} onalign={(edge) => place.align?.(edge)} ondistribute={() => {}} />
</fieldset>

<div class="place" data-testid="frame-place-section">
  <NumberField label="X" kind={FieldKind.Glyph} name="Frame X" value={Math.round(place.x)} range={RANGE} unit="px" onchange={(x) => place.set(x, place.y)} />
  <NumberField label="Y" kind={FieldKind.Glyph} name="Frame Y" value={Math.round(place.y)} range={RANGE} unit="px" onchange={(y) => place.set(place.x, y)} />
  <NumberField label="Rotate" kind={FieldKind.Glyph} name="Frame rotation" value={Math.round(place.rotation)} range={TURN_RANGE} unit="°" onchange={(d) => place.turn(d)} />
  <div class="flips" role="group" aria-label="Flip">
    <button type="button" aria-label="Flip horizontal" title="Flip horizontal ⇧H" data-testid="frame-flip-horizontal" onclick={() => place.flip(Flip.Horizontal)}><FlipHorizontal size={ICON} /></button>
    <button type="button" aria-label="Flip vertical" title="Flip vertical ⇧V" data-testid="frame-flip-vertical" onclick={() => place.flip(Flip.Vertical)}><FlipVertical size={ICON} /></button>
  </div>
</div>

<style>
  .align {
    margin: 0;
    padding: var(--ui-space-3) var(--ui-space-4) 0;
    border: 0;
    min-width: 0;
  }

  .align:disabled {
    opacity: 0.4;
  }

  .place {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--ui-space-2);
    padding: var(--ui-space-3) var(--ui-space-4) 0;
  }

  .flips {
    display: flex;
    gap: var(--ui-space-1);
  }

  .flips button {
    display: grid;
    place-items: center;
    flex: 1;
    height: var(--ui-control-h);
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: inherit;
    cursor: pointer;
  }

  .flips button:hover {
    background: var(--ui-input-hover);
  }
</style>
