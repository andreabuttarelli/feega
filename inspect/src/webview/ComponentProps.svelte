<script lang="ts">
  import { ControlKind, type PropControl, type PropValue, type Variants } from './prop-controls';

  type Props = { controls: PropControl[]; values: Record<string, unknown>; grid: boolean; variants: Variants; onchange: (name: string, value: PropValue | undefined) => void; ongrid: (on: boolean) => void };

  let { controls, values, grid, variants, onchange, ongrid }: Props = $props();

  const shown = $derived(variants.variants?.length ?? 0);
  const note = $derived(variants.dropped.length ? `Showing ${shown} of ${variants.total} combinations. Left out: ${variants.dropped.join(', ')}.` : `${shown} combinations.`);
  const textOf = (value: unknown) => (value === undefined || value === null ? '' : String(value));
  const numberOf = (raw: string) => (raw === '' ? undefined : Number(raw));
</script>

<section data-section="Props" data-testid="component-props">
  <div class="head">
    <span class="title">Props</span>
    {#if variants.variants}
      <button type="button" class="grid" class:on={grid} aria-pressed={grid} data-testid="variants-toggle" onclick={() => ongrid(!grid)}>Variants</button>
    {/if}
  </div>
  {#if grid && variants.variants}<p class="note" data-testid="variants-note">{note}</p>{/if}
  {#each controls as control (control.name)}
    <div class="row" data-row={control.name}>
      <span class="label" title={control.name}>{control.name}</span>
      <div class="control">
        {#if control.kind === ControlKind.Select}
          <select class="text" value={textOf(values[control.name])} aria-label={control.name} data-field={control.name} onchange={(e) => onchange(control.name, e.currentTarget.value)}>
            {#if values[control.name] === undefined}<option value="" disabled selected>unset</option>{/if}
            {#each control.options ?? [] as option (option)}<option value={option}>{option}</option>{/each}
          </select>
        {:else if control.kind === ControlKind.Toggle}
          <input type="checkbox" checked={values[control.name] === true} aria-label={control.name} data-field={control.name} onchange={(e) => onchange(control.name, e.currentTarget.checked)} />
        {:else if control.kind === ControlKind.Number}
          <input type="number" class="text" value={textOf(values[control.name])} aria-label={control.name} data-field={control.name} onchange={(e) => onchange(control.name, numberOf(e.currentTarget.value))} />
        {:else}
          <input type="text" class="text" value={textOf(values[control.name])} aria-label={control.name} data-field={control.name} onchange={(e) => onchange(control.name, e.currentTarget.value)} />
        {/if}
      </div>
    </div>
  {/each}
</section>

<style>
  section {
    --label-w: 72px;
    padding: 0 0 8px;
    border-bottom: 1px solid var(--ui-divider);
    font-size: var(--ui-text-sm);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 32px;
    padding: 0 12px;
  }

  .title {
    color: var(--ui-text);
    font-size: var(--ui-text-xs);
    font-weight: 600;
  }

  .grid {
    height: 22px;
    padding: 0 8px;
    border: 1px solid var(--ui-field-border);
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-2);
    font: inherit;
    font-size: var(--ui-text-xs);
  }

  .grid.on {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .note {
    margin: 0;
    padding: 0 12px 6px;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }

  .row {
    display: grid;
    grid-template-columns: var(--label-w) minmax(0, 1fr);
    align-items: center;
    gap: 8px;
    min-height: 28px;
    padding: 4px 12px;
  }

  .label {
    overflow: hidden;
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .control {
    display: flex;
    min-width: 0;
  }

  .text {
    flex: 1;
    min-width: 0;
    height: 28px;
    padding: 0 8px;
    border: 1px solid var(--ui-field-border);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
  }
</style>
