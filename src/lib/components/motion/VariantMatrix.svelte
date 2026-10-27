<script lang="ts">
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import { defineVariantProp, setVariant, variantMatrix, type MatrixCell } from '$lib/motion/variants';

  let { doc, clipId, compId, onchange }: { doc: MotionDoc; clipId: string; compId: string; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  const SEPARATOR = ' · ';
  const matrix = $derived(variantMatrix(doc, compId));
  const keys = $derived(Object.keys(matrix.axes));
  const rowKey = $derived(keys[0]);
  const columnKeys = $derived(keys.slice(1));
  const current = $derived(doc.comps[compId]?.component?.variant ?? {});

  const columns = $derived(
    matrix.cells.filter((c) => c.variant[rowKey] === matrix.axes[rowKey]?.[0]).map((c) => columnKeys.map((k) => c.variant[k]).join(SEPARATOR))
  );
  const cellAt = (row: string, column: string): MatrixCell | undefined =>
    matrix.cells.find((c) => c.variant[rowKey] === row && columnKeys.map((k) => c.variant[k]).join(SEPARATOR) === column);
  const isCurrent = (cell: MatrixCell | undefined) => !!cell && cell.compId === compId;

  let axisName = $state('');
  let axisValues = $state('');

  function pick(cell: MatrixCell | undefined) {
    if (!cell?.compId) {
      return;
    }
    const result = setVariant(doc, clipId, cell.variant);
    if (result.ok) {
      onchange(result.doc, 'Changed variant');
    }
  }

  function addAxis() {
    const values = axisValues.split(',').map((v) => v.trim()).filter(Boolean);
    const result = defineVariantProp(doc, compId, axisName.trim(), values, () => crypto.randomUUID().slice(0, 8));
    if (!result.ok) {
      return;
    }
    onchange(result.doc, 'Defined a variant property');
    axisName = '';
    axisValues = '';
  }
</script>

<div class="matrix" data-testid="variant-matrix">
  {#if keys.length}
    <div class="grid" style:grid-template-columns={`auto repeat(${columns.length}, 1fr)`}>
      <span class="corner">{rowKey}{columnKeys.length ? ` / ${columnKeys.join(SEPARATOR)}` : ''}</span>
      {#each columns as column (column)}<span class="head">{column || '·'}</span>{/each}
      {#each matrix.axes[rowKey] as row (row)}
        <span class="head">{row}</span>
        {#each columns as column (column)}
          {@const cell = cellAt(row, column)}
          <button type="button" class="cell" class:current={isCurrent(cell)} class:empty={!cell?.compId} disabled={!cell?.compId} data-testid="variant-cell" data-variant={JSON.stringify(cell?.variant ?? {})} onclick={() => pick(cell)}>
            {cell?.compId ? '' : '–'}
          </button>
        {/each}
      {/each}
    </div>
  {/if}
  <div class="define">
    <input type="text" placeholder="Property (Size)" bind:value={axisName} data-testid="variant-axis-name" />
    <input type="text" placeholder="Values (S, M, L)" bind:value={axisValues} data-testid="variant-axis-values" />
    <button type="button" data-testid="variant-axis-add" disabled={!axisName.trim() || !axisValues.trim()} onclick={addAxis}>Add property</button>
  </div>
</div>

<style>
  .matrix {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
  }

  .grid {
    display: grid;
    gap: 2px;
    font-size: var(--ui-type-caption);
    color: var(--ui-text-secondary);
  }

  .corner,
  .head {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 2px 4px;
  }

  .cell {
    min-height: 20px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-surface);
    cursor: pointer;
  }

  .cell.current {
    border-color: #9747ff;
    background: #9747ff;
  }

  .cell.empty {
    cursor: default;
    color: var(--ui-text-secondary);
  }

  .define {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: var(--ui-space-2);
  }

  input,
  button:not(.cell) {
    min-width: 0;
    padding: 4px 6px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-surface);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-type-caption);
  }
</style>
