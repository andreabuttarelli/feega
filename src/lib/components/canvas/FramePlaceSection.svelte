<script lang="ts">
  import NumberField from '$lib/components/motion/NumberField.svelte';
  import { FieldKind } from '$lib/motion/number-field';
  import type { NodePlace } from './frame-properties.svelte';
  import type { ElementHost } from '$lib/motion/element-host';

  let { place, host = null }: { place: NodePlace; host?: ElementHost | null } = $props();

  const TURN_RANGE = { min: -360, max: 360, step: 1 };

  const RANGE = { min: -1_000_000, max: 1_000_000, step: 1 };
</script>

<div class="place" data-testid="frame-place-section">
  <NumberField label="X" kind={FieldKind.Glyph} name="Frame X" value={Math.round(place.x)} range={RANGE} unit="px" onchange={(x) => place.set(x, place.y)} />
  <NumberField label="Y" kind={FieldKind.Glyph} name="Frame Y" value={Math.round(place.y)} range={RANGE} unit="px" onchange={(y) => place.set(place.x, y)} />
  {#if host}<NumberField label="Rotate" kind={FieldKind.Glyph} name="Frame rotation" value={Math.round(host.box.rotation)} range={TURN_RANGE} unit="°" onchange={(d) => host.turn(d)} />{/if}
</div>

<style>
  .place {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--ui-space-2);
    padding: var(--ui-space-3) var(--ui-space-4) 0;
  }
</style>
