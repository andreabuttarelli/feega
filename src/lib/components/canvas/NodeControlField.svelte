<script lang="ts" module>
  import type { Component } from 'svelte';
  import type { ControlKind } from '$lib/canvas/node-controls';
  import {
    ControlLayout,
    NumberField,
    OptionMenu,
    RatioChips,
    Segmented,
    SliderField,
    Switch,
    type ControlProps
  } from '$lib/components/ui/control/index.js';

  const CONTROL: Record<ControlKind, { component: Component<ControlProps>; layout: ControlLayout }> = {
    segmented: { component: Segmented, layout: ControlLayout.Stack },
    chips: { component: Segmented, layout: ControlLayout.Stack },
    ratio: { component: RatioChips, layout: ControlLayout.Stack },
    menu: { component: OptionMenu, layout: ControlLayout.Stack },
    slider: { component: SliderField, layout: ControlLayout.Stack },
    switch: { component: Switch, layout: ControlLayout.Inline },
    number: { component: NumberField, layout: ControlLayout.Inline }
  };
</script>

<script lang="ts">
  import { patchOf, type NodeControl, type SelectionPatch } from '$lib/canvas/node-controls';
  import { ControlRow, MIXED_TEXT } from '$lib/components/ui/control/index.js';

  let { control, onchange }: { control: NodeControl; onchange: (patch: SelectionPatch) => void } = $props();

  const spec = $derived(CONTROL[control.kind]);
  const hint = $derived(control.mixed ? `${MIXED_TEXT}: a choice here applies to every selected node` : undefined);
</script>

<ControlRow label={control.label} {hint} layout={spec.layout} control={control.id}>
  <spec.component
    label={control.label}
    value={control.value}
    mixed={control.mixed}
    options={control.options}
    min={control.min}
    max={control.max}
    onchange={(value) => onchange(patchOf(control, value))}
  />
</ControlRow>
