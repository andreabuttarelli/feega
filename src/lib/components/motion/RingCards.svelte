<script lang="ts">
  import { CardKind, MAX_RING_CARDS, type RingCard } from '$lib/motion/ring/model';
  import type { MotionDoc } from '$lib/motion/doc';

  type Source = { kind: CardKind; ref: string; label: string };

  let {
    cards,
    doc,
    assets,
    onchange
  }: {
    cards: RingCard[];
    doc: MotionDoc;
    assets: { id: string; kind: string; label: string }[];
    onchange: (cards: RingCard[]) => void;
  } = $props();

  const SOURCE_KIND: Record<string, CardKind> = { image: CardKind.Image, video: CardKind.Video };

  const sources = $derived<Source[]>([
    ...Object.entries(doc.comps).map(([ref, comp]) => ({ kind: CardKind.Comp, ref, label: `Composition · ${comp.name}` })),
    ...assets.filter((a) => SOURCE_KIND[a.kind]).map((a) => ({ kind: SOURCE_KIND[a.kind], ref: a.id, label: a.label }))
  ]);

  const keyOf = (c: RingCard) => `${c.kind}:${c.ref}`;
  const cardOf = (key: string): RingCard => {
    const at = key.indexOf(':');
    return { kind: key.slice(0, at) as CardKind, ref: key.slice(at + 1) };
  };

  const replace = (i: number, key: string) => onchange(cards.map((c, k) => (k === i ? cardOf(key) : c)));
  const remove = (i: number) => onchange(cards.filter((_, k) => k !== i));
  const add = (key: string) => onchange([...cards, cardOf(key)]);
</script>

<div class="cards" data-testid="ring-cards">
  {#each cards as card, i (i)}
    <div class="row">
      <select aria-label={`Card ${i + 1}`} value={keyOf(card)} onchange={(e) => replace(i, e.currentTarget.value)}>
        {#each sources as s (keyOf(s))}<option value={keyOf(s)}>{s.label}</option>{/each}
      </select>
      <button type="button" aria-label={`Remove card ${i + 1}`} onclick={() => remove(i)}>×</button>
    </div>
  {/each}
  {#if cards.length < MAX_RING_CARDS && sources.length}
    <select aria-label="Add a card" value="" onchange={(e) => add(e.currentTarget.value)}>
      <option value="" disabled>Add a card…</option>
      {#each sources as s (keyOf(s))}<option value={keyOf(s)}>{s.label}</option>{/each}
    </select>
  {:else if !sources.length}
    <span class="empty">Precompose some clips or add images to fill the cards.</span>
  {/if}
</div>

<style>
  .cards {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }
  .row {
    display: flex;
    gap: 4px;
  }
  .row select {
    flex: 1;
    min-width: 0;
  }
  .empty {
    font-size: 11px;
    opacity: 0.7;
  }
</style>
