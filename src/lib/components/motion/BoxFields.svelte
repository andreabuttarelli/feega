<script lang="ts">
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import { EditMode } from '$lib/motion/edit-mode';
  import { BOX_FIELDS, boxValue, layerBoxes, setLayerBox, type BoxKey } from '$lib/motion/layer-box';
  import { FieldKind } from '$lib/motion/number-field';
  import type { LiveGesture } from '$lib/motion/live-edit';
  import NumberField from './NumberField.svelte';

  let { doc, ids, frame, mode = EditMode.Design, gesture = null, onchange }: { doc: MotionDoc; ids: readonly string[]; frame: number; mode?: EditMode; gesture?: LiveGesture | null; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  const BOX_RANGE = { min: -100000, max: 100000, step: 1 };

  const placed = $derived(layerBoxes(doc, ids, frame));

  function place(key: BoxKey, value: number) {
    const result = setLayerBox(doc, placed, key, value, frame, mode);
    if (result.ok) {
      onchange(result.doc, ids.length > 1 ? `Placed ${ids.length} layers` : 'Placed the layer');
    }
  }
</script>

{#if placed.length}
  <div class="box-fields" data-testid="box-fields">
    {#each BOX_FIELDS as f (f.key)}
      <div data-prop={f.key}>
        <NumberField {gesture} label={f.label} kind={FieldKind.Glyph} name={f.name} value={boxValue(placed, f.key)} range={BOX_RANGE} unit="px" onchange={(v) => place(f.key, v)} />
      </div>
    {/each}
  </div>
{/if}

<style>
  .box-fields {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 6px;
  }
</style>
