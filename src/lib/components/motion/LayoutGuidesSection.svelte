<script lang="ts">
  import type { MotionDoc } from '$lib/motion/doc';
  import type { OpResult } from '$lib/motion/timeline';
  import { GuideAlign, GuideKind, newGuide, setLayoutGuides, type LayoutGuide } from '$lib/motion/layout-guides/guides';
  import { AUTO_COUNT, DEFAULT_AUTO_SIZE, DEFAULT_GUIDE_SIZE, MAX_LAYOUT_GUIDES } from '$lib/motion/layout-guides/model';

  let { doc, onchange }: { doc: MotionDoc; onchange: (result: OpResult, summary: string) => void } = $props();

  const guides = $derived(doc.layoutGuides ?? []);
  const ADD_TITLE = 'Add a layout grid: columns, rows or grid. Elements snap to it. ⇧G shows or hides all grids';
  const KINDS = Object.values(GuideKind);
  const ALIGNS = Object.values(GuideAlign);

  const write = (next: LayoutGuide[], summary: string) => onchange(setLayoutGuides(doc, next), summary);
  const patch = (index: number, change: Partial<LayoutGuide>) => write(guides.map((g, i) => (i === index ? { ...g, ...change } : g)), 'Changed a layout grid');

  const countOf = (text: string) => (text.trim().toLowerCase() === AUTO_COUNT ? AUTO_COUNT : Number(text));

  function count(index: number, text: string) {
    const value = countOf(text);
    if (value === AUTO_COUNT) {
      patch(index, { count: value, size: guides[index].size === DEFAULT_GUIDE_SIZE ? DEFAULT_AUTO_SIZE : guides[index].size });
      return;
    }
    if (Number.isFinite(value)) {
      patch(index, { count: value });
    }
  }

  function number(index: number, key: 'gutter' | 'margin' | 'size' | 'offset', text: string) {
    const value = Number(text);
    if (!Number.isFinite(value)) {
      return;
    }
    patch(index, { [key]: value });
  }
</script>

<div class="guides" data-testid="layout-guides-section">
  <header>
    <span>Layout grid</span>
    <button type="button" class="add" aria-label="Add layout grid" title={ADD_TITLE} disabled={guides.length >= MAX_LAYOUT_GUIDES} onclick={() => write([...guides, newGuide(GuideKind.Columns)], 'Added a layout grid')} data-testid="add-layout-guide">+</button>
  </header>
  {#each guides as guide, i (i)}
    <div class="guide" data-testid="layout-guide">
      <select aria-label="Grid kind" value={guide.kind} onchange={(e) => patch(i, { kind: e.currentTarget.value as GuideKind })}>
        {#each KINDS as kind (kind)}<option value={kind}>{kind}</option>{/each}
      </select>
      {#if guide.kind === GuideKind.Grid}
        <input type="number" min="1" aria-label="Cell size" title="Cell size in px" value={guide.size} onchange={(e) => number(i, 'size', e.currentTarget.value)} />
      {:else}
        <input type="text" inputmode="numeric" aria-label="Count" title="Count, or auto" value={guide.count} onchange={(e) => count(i, e.currentTarget.value)} />
        <input type="number" min="0" aria-label="Gutter" title="Gutter in px" value={guide.gutter} onchange={(e) => number(i, 'gutter', e.currentTarget.value)} />
        <select aria-label="Alignment" value={guide.align} onchange={(e) => patch(i, { align: e.currentTarget.value as GuideAlign })}>
          {#each ALIGNS as align (align)}<option value={align}>{align}</option>{/each}
        </select>
        {#if guide.align === GuideAlign.Stretch}
          <input type="number" min="0" aria-label="Margin" title="Margin in px" value={guide.margin} onchange={(e) => number(i, 'margin', e.currentTarget.value)} />
        {:else}
          <input type="number" min="1" aria-label="Section size" title="Section size in px" value={guide.size} onchange={(e) => number(i, 'size', e.currentTarget.value)} />
          {#if guide.align !== GuideAlign.Center}
            <input type="number" min="0" aria-label="Offset" title="Offset in px" value={guide.offset} onchange={(e) => number(i, 'offset', e.currentTarget.value)} />
          {/if}
        {/if}
      {/if}
      <input type="color" aria-label="Guide colour" title="Colour" value={guide.color} onchange={(e) => patch(i, { color: e.currentTarget.value })} />
      <input type="number" min="0" max="100" step="5" aria-label="Guide opacity" title="Opacity %" value={Math.round(guide.opacity * 100)} onchange={(e) => patch(i, { opacity: Math.min(1, Math.max(0, Number(e.currentTarget.value) / 100)) })} />
      <label class="toggle" title="Show this grid"><input type="checkbox" checked={!guide.hidden} onchange={(e) => patch(i, { hidden: !e.currentTarget.checked })} /></label>
      <button type="button" class="remove" aria-label="Remove grid" onclick={() => write(guides.filter((_, j) => j !== i), 'Removed a layout grid')}>Remove</button>
    </div>
  {/each}
</div>

<style>
  .guides {
    display: grid;
    gap: 6px;
    padding: 12px;
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-2);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .guide {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
    align-items: center;
  }

  select,
  input[type='text'],
  input[type='number'] {
    min-width: 0;
    width: 100%;
    height: 28px;
    padding: 0 6px;
    border: 1px solid transparent;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-ink);
    font: inherit;
    font-variant-numeric: tabular-nums;
  }

  .add,
  .remove {
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-ink);
    font: inherit;
    cursor: pointer;
  }

  .add:hover,
  .remove:hover {
    background: var(--ui-hover);
  }

  input[type='color'] {
    width: 100%;
    height: 28px;
    padding: 0;
    border: 0;
    background: none;
  }

  .toggle input {
    margin: 0;
  }
</style>
