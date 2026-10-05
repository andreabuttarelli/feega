<script lang="ts">
  import { bentoGridPatch, cellSpanPatch, type BentoGridKey, type CompositionNode, type SpanKey, type UpstreamCard } from '$lib/canvas/composition-node';
  import { BENTO_GRID, params } from '$lib/canvas/composition/bento';
  import { clampParams } from '$lib/canvas/composition/clamp';

  let { node, cards, onpatch }: { node: CompositionNode; cards: UpstreamCard[]; onpatch: (patch: Partial<CompositionNode>) => void } = $props();

  const GRID: { key: BentoGridKey; label: string }[] = [
    { key: 'columns', label: 'Columns' },
    { key: 'rows', label: 'Rows' },
    { key: 'gap', label: 'Gap' },
    { key: 'cornerRadius', label: 'Radius' }
  ];
  const SPANS: { key: SpanKey; label: string }[] = [
    { key: 'columns', label: 'W' },
    { key: 'rows', label: 'H' }
  ];

  const values = $derived(clampParams(params, node.layoutParams));
  const rangeOf = (key: BentoGridKey) => params.find((p) => p.name === key) as { min: number; max: number };
  const numberOf = (e: Event) => Number((e.currentTarget as HTMLInputElement).value);
</script>

<div class="bento-panel nodrag" data-testid="bento-panel">
  <div class="row">
    {#each GRID as g (g.key)}
      <label>
        {g.label}
        <input type="number" min={rangeOf(g.key).min} max={rangeOf(g.key).max} value={values[g.key]} onchange={(e) => onpatch(bentoGridPatch(node, g.key, numberOf(e)))} />
      </label>
    {/each}
  </div>
  {#each cards as card, i (card.sourceId + i)}
    <div class="row">
      <span class="cell">Cell {i + 1} · {card.kind}</span>
      {#each SPANS as s (s.key)}
        <label>
          {s.label}
          <input type="number" min={BENTO_GRID.min} max={BENTO_GRID.max} value={node.cells[card.sourceId]?.[s.key] ?? 1} onchange={(e) => onpatch(cellSpanPatch(node, card.sourceId, s.key, numberOf(e)))} />
        </label>
      {/each}
    </div>
  {/each}
</div>

<style>
  .bento-panel {
    position: absolute;
    left: 8px;
    bottom: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px;
    max-height: 60%;
    overflow: auto;
    background: var(--paper, #fff);
    border: 1px solid var(--line, #e5e5e5);
    font-size: 11px;
    color: var(--ink, #1d1d1f);
  }
  .row {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .cell {
    min-width: 92px;
    color: var(--ink-soft, #6e6e73);
  }
  label {
    display: flex;
    gap: 3px;
    align-items: center;
  }
  input {
    width: 44px;
    font: inherit;
    border: 1px solid var(--line, #e5e5e5);
    padding: 1px 3px;
  }
</style>
