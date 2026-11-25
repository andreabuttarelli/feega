<script lang="ts">
  import { EDITORS, INVALID, Input, type PropControl, type PropValue, type Variants } from './prop-controls';

  type Apply = { ready: boolean; usage: boolean; skipped: string[] };
  type Props = { controls: PropControl[]; values: Record<string, unknown>; grid: boolean; variants: Variants; apply: Apply; onchange: (name: string, value: PropValue | undefined) => void; ongrid: (on: boolean) => void; onapply: () => void };

  let { controls, values, grid, variants, apply, onchange, ongrid, onapply }: Props = $props();

  let invalid = $state<Record<string, boolean>>({});

  const applyTitle = $derived(!apply.usage ? 'Select the instance on the page to write its props back' : !apply.ready ? 'Edit a prop first' : 'Write the edited props into the source where this instance is used');
  const skippedNote = $derived(apply.skipped.length ? `Not written: ${apply.skipped.join(', ')} (callbacks and children stay in code).` : null);

  const shown = $derived(variants.variants?.length ?? 0);
  const note = $derived(variants.dropped.length ? `Showing ${shown} of ${variants.total} combinations. Left out: ${variants.dropped.join(', ')}.` : `${shown} combinations.`);

  function commit(control: PropControl, raw: string) {
    const value = EDITORS[control.kind].read(raw, control);
    invalid[control.name] = value === INVALID;
    if (value !== INVALID) {
      onchange(control.name, value);
    }
  }
</script>

<section data-section="Props" data-testid="component-props">
  <div class="head">
    <span class="title">Props</span>
    {#if variants.variants}
      <button type="button" class="grid" class:on={grid} aria-pressed={grid} data-testid="variants-toggle" onclick={() => ongrid(!grid)}>Variants</button>
    {/if}
  </div>
  <div class="apply">
    <button type="button" class="grid" data-testid="apply-props" disabled={!apply.ready} title={applyTitle} onclick={onapply}>Apply to page</button>
    {#if skippedNote}<span class="note" data-testid="apply-skipped">{skippedNote}</span>{/if}
  </div>
  {#if grid && variants.variants}<p class="note" data-testid="variants-note">{note}</p>{/if}
  {#each controls as control (control.name)}
    {@const editor = EDITORS[control.kind]}
    {@const current = editor.show(values[control.name], control)}
    <div class="row" data-row={control.name} data-kind={control.kind}>
      <span class="label" title={control.name}>{control.name}{#if control.required}<span class="required" title="Required" aria-label="required">*</span>{/if}</span>
      <div class="control">
        {#if editor.input === Input.Select}
          <select class="text" value={current} aria-label={control.name} data-field={control.name} onchange={(e) => commit(control, e.currentTarget.value)}>
            {#if values[control.name] === undefined}<option value="" disabled selected>unset</option>{/if}
            {#each control.options ?? [] as option (option)}<option value={String(option)}>{option}</option>{/each}
          </select>
        {:else if editor.input === Input.Checkbox}
          <input type="checkbox" checked={current === 'true'} aria-label={control.name} data-field={control.name} onchange={(e) => commit(control, String(e.currentTarget.checked))} />
        {:else if editor.input === Input.Json}
          <textarea class="text json" class:invalid={invalid[control.name]} rows="3" spellcheck="false" aria-label={control.name} aria-invalid={invalid[control.name] ? 'true' : 'false'} data-field={control.name} value={current} onchange={(e) => commit(control, e.currentTarget.value)}></textarea>
        {:else if editor.input === Input.Readonly}
          <span class="text readonly" data-field={control.name}>{current}</span>
        {:else}
          {#if editor.swatch}
            <input type="color" class="swatch" value={editor.swatch(values[control.name])} aria-label="{control.name} picker" oninput={(e) => commit(control, e.currentTarget.value)} />
          {/if}
          <input type={editor.input} class="text" value={current} aria-label={control.name} data-field={control.name} onchange={(e) => commit(control, e.currentTarget.value)} />
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

  .apply {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 0 12px 6px;
  }

  .grid:disabled {
    opacity: 0.5;
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

  .required {
    margin-left: 2px;
    color: var(--ui-text-2);
  }

  .swatch {
    flex: none;
    width: 28px;
    height: 28px;
    padding: 2px;
    margin-right: 4px;
    border: 1px solid var(--ui-field-border);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
  }

  .json {
    height: auto;
    padding: 4px 8px;
    font-family: var(--ui-mono, monospace);
    font-size: var(--ui-text-xs);
    resize: vertical;
  }

  .invalid {
    border-color: var(--ui-danger, #d33);
  }

  .readonly {
    display: flex;
    align-items: center;
    color: var(--ui-text-2);
    font-style: italic;
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
