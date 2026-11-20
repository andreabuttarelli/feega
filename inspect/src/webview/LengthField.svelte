<script lang="ts">
  import NumberField from '@feega/properties-panel/NumberField.svelte';
  import { MIXED, type Shared } from '@feega/properties-panel/mixed';
  import type { Range } from '@feega/properties-panel/number-field';
  import { Unit, convert, cssOf, parseLength, stepOf, type UnitContext } from './units';

  let { label, name, px, range, units, context, onchange }: { label: string; name: string; px: Shared<number>; range: Range; units: Unit[]; context: UnitContext; onchange: (css: string) => void } = $props();

  let unit = $state<Unit>(Unit.Px);
  const shown = $derived(px === MIXED || unit === Unit.Auto ? px : convert({ value: px, unit: Unit.Px }, unit, context).value);
  const unitRange = $derived({ min: range.min === 0 ? 0 : range.min, max: unit === Unit.Px ? range.max : range.max / 4, step: stepOf(unit) });

  function pickUnit(next: Unit) {
    if (next === Unit.Auto) {
      unit = next;
      onchange(Unit.Auto);
      return;
    }
    unit = next;
  }

  function typed(e: KeyboardEvent) {
    const input = e.target as HTMLInputElement;
    if (e.key !== 'Enter') {
      return;
    }
    const parsed = parseLength(input.value, unit);
    if (parsed && parsed.unit !== unit) {
      e.preventDefault();
      e.stopPropagation();
      unit = parsed.unit;
      onchange(cssOf(parsed));
    }
  }
</script>

<div class="length" role="presentation" onkeydowncapture={typed}>
  <NumberField {label} {name} value={shown} range={unitRange} blank={unit === Unit.Auto ? 'auto' : null} onchange={(v) => onchange(cssOf({ value: v, unit }))} />
  <select class="unit" value={unit} aria-label={`${name} unit`} onchange={(e) => pickUnit(e.currentTarget.value as Unit)}>
    {#each units as u (u)}<option value={u}>{u || '–'}</option>{/each}
  </select>
</div>

<style>
  .length {
    position: relative;
    display: flex;
    align-items: center;
  }

  .length :global(.field) {
    flex: 1;
    min-width: 0;
  }

  .unit {
    position: absolute;
    right: 2px;
    width: 34px;
    height: 20px;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-xs);
    background: transparent;
    color: var(--ui-text-3);
    font: inherit;
    font-size: var(--ui-text-xs);
    text-align: right;
    cursor: pointer;
  }
</style>
