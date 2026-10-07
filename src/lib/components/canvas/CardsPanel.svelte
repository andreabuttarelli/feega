<script lang="ts">
  import { cardShapePatch, type CompositionNode, type UpstreamCard } from '$lib/canvas/composition-node';
  import { CARD_ASPECTS, RATIO_RANGE, type CardAspect } from '$lib/canvas/composition/card-look';
  import { CELL_FITS, type CellFit } from '$lib/motion/bento/model';

  let { node, cards, onpatch }: { node: CompositionNode; cards: UpstreamCard[]; onpatch: (patch: Partial<CompositionNode>) => void } = $props();

  const LAYOUT_DEFAULT = '';
  const FREE: CardAspect = 'free';

  const valueOf = (e: Event) => (e.currentTarget as HTMLSelectElement | HTMLInputElement).value;
  const aspectOf = (raw: string) => (raw === LAYOUT_DEFAULT ? undefined : (raw as CardAspect));
</script>

<details class="cards-panel nodrag" data-testid="cards-panel">
  <summary>Cards</summary>
  {#each cards as card, i (card.sourceId + i)}
    {@const cell = node.cells[card.sourceId] ?? {}}
    <div class="row">
      <span class="cell">{i + 1} · {card.kind}</span>
      <select aria-label={`Ratio of card ${i + 1}`} value={cell.aspect ?? LAYOUT_DEFAULT} onchange={(e) => onpatch(cardShapePatch(node, card.sourceId, { aspect: aspectOf(valueOf(e)) }))}>
        <option value={LAYOUT_DEFAULT}>layout</option>
        {#each CARD_ASPECTS as aspect (aspect)}
          <option value={aspect}>{aspect}</option>
        {/each}
      </select>
      {#if cell.aspect === FREE}
        <input type="number" aria-label={`Free ratio of card ${i + 1}`} min={RATIO_RANGE.min} max={RATIO_RANGE.max} step="0.01" value={cell.ratio ?? 1} onchange={(e) => onpatch(cardShapePatch(node, card.sourceId, { ratio: Number(valueOf(e)) }))} />
      {/if}
      <select aria-label={`Fit of card ${i + 1}`} value={cell.fit ?? CELL_FITS[0]} onchange={(e) => onpatch(cardShapePatch(node, card.sourceId, { fit: valueOf(e) as CellFit }))}>
        {#each CELL_FITS as fit (fit)}
          <option value={fit}>{fit}</option>
        {/each}
      </select>
    </div>
  {/each}
</details>

<style>
  .cards-panel {
    position: absolute;
    left: 8px;
    bottom: 8px;
    padding: 4px 6px;
    max-height: 60%;
    overflow: auto;
    background: var(--paper, #fff);
    border: 1px solid var(--line, #e5e5e5);
    font-size: 11px;
    color: var(--ink, #1d1d1f);
  }
  .row {
    display: flex;
    gap: 4px;
    align-items: center;
    margin-top: 4px;
  }
  input {
    width: 48px;
  }
</style>
