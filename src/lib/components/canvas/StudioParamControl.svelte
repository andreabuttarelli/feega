<script lang="ts" module>
  import type { Component } from 'svelte';
  import type { Control } from '$lib/canvas/effects/editor';
  import { enumKindOf } from '$lib/canvas/node-controls';
  import {
    ColorField,
    ControlLayout,
    NumberField,
    OptionMenu,
    Segmented,
    SliderField,
    type ControlProps
  } from '$lib/components/ui/control/index.js';

  type StudioKind = 'slider' | 'segmented' | 'menu' | 'color' | 'seed';

  const CONTROL: Record<StudioKind, { component: Component<ControlProps>; layout: ControlLayout }> = {
    slider: { component: SliderField, layout: ControlLayout.Stack },
    segmented: { component: Segmented, layout: ControlLayout.Stack },
    menu: { component: OptionMenu, layout: ControlLayout.Stack },
    color: { component: ColorField, layout: ControlLayout.Inline },
    seed: { component: NumberField, layout: ControlLayout.Stack }
  };

  function kindOf(control: Control): StudioKind {
    return control.kind === 'select' ? enumKindOf(control.options.length) : control.kind;
  }
</script>

<script lang="ts">
  import Dices from '@lucide/svelte/icons/dices';
  import { Button } from '$lib/components/ui/button/index.js';
  import { ControlRow } from '$lib/components/ui/control/index.js';

  const SEED_CEILING = 1_000_000;

  let { label, control, onchange }: { label: string; control: Control; onchange: (value: number | string) => void } = $props();

  const spec = $derived(CONTROL[kindOf(control)]);
  const range = $derived(control.kind === 'slider' ? { min: control.min, max: control.max, step: control.step } : {});
  const options = $derived(control.kind === 'select' ? control.options : []);

  function reroll() {
    onchange(Math.floor(Math.random() * SEED_CEILING));
  }
</script>

<ControlRow {label} layout={spec.layout}>
  {#if control.kind === 'seed'}
    <NumberField {label} value={control.value} onchange={(v) => onchange(Number(v))}>
      {#snippet action()}
        <Button variant="secondary" size="icon-sm" class="size-11 md:size-8" aria-label="New seed" onclick={reroll}>
          <Dices strokeWidth={1.75} />
        </Button>
      {/snippet}
    </NumberField>
  {:else}
    <spec.component {label} value={control.value} {options} {...range} onchange={(v) => onchange(v as number | string)} />
  {/if}
</ControlRow>
