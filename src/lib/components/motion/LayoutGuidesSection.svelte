<script lang="ts">
  import type { MotionDoc } from '$lib/motion/doc';
  import type { OpResult } from '$lib/motion/timeline';
  import { GuideKind, newGuide, setLayoutGuides, type LayoutGuide } from '$lib/motion/layout-guides/guides';
  import { MAX_LAYOUT_GUIDES } from '$lib/motion/layout-guides/model';

  let { doc, onchange }: { doc: MotionDoc; onchange: (result: OpResult, summary: string) => void } = $props();

  const guides = $derived(doc.layoutGuides ?? []);
  const KINDS = Object.values(GuideKind);

  const write = (next: LayoutGuide[], summary: string) => onchange(setLayoutGuides(doc, next), summary);
  const patch = (index: number, change: Partial<LayoutGuide>) => write(guides.map((g, i) => (i === index ? { ...g, ...change } : g)), 'Changed a layout guide');

  function number(index: number, key: 'count' | 'gutter' | 'margin' | 'size', text: string) {
    const value = Number(text);
    if (!Number.isFinite(value)) {
      return;
    }
    patch(index, { [key]: value });
  }
</script>

<div class="guides" data-testid="layout-guides-section">
  <header>
    <span>Layout guides</span>
    <button type="button" class="add" disabled={guides.length >= MAX_LAYOUT_GUIDES} onclick={() => write([...guides, newGuide(GuideKind.Columns)], 'Added a layout guide')} data-testid="add-layout-guide">Add</button>
  </header>
  {#each guides as guide, i (i)}
    <div class="guide" data-testid="layout-guide">
      <select aria-label="Guide kind" value={guide.kind} onchange={(e) => patch(i, { kind: e.currentTarget.value as GuideKind })}>
        {#each KINDS as kind (kind)}<option value={kind}>{kind}</option>{/each}
      </select>
      {#if guide.kind === GuideKind.Grid}
        <input type="number" min="1" aria-label="Cell size" title="Cell size in px" value={guide.size} onchange={(e) => number(i, 'size', e.currentTarget.value)} />
      {:else}
        <input type="number" min="1" aria-label="Count" title="Count" value={guide.count} onchange={(e) => number(i, 'count', e.currentTarget.value)} />
        <input type="number" min="0" aria-label="Gutter" title="Gutter in px" value={guide.gutter} onchange={(e) => number(i, 'gutter', e.currentTarget.value)} />
        <input type="number" min="0" aria-label="Margin" title="Margin in px" value={guide.margin} onchange={(e) => number(i, 'margin', e.currentTarget.value)} />
      {/if}
      <label class="toggle" title="Show this guide"><input type="checkbox" checked={!guide.hidden} onchange={(e) => patch(i, { hidden: !e.currentTarget.checked })} /></label>
      <button type="button" class="remove" aria-label="Remove guide" onclick={() => write(guides.filter((_, j) => j !== i), 'Removed a layout guide')}>Remove</button>
    </div>
  {/each}
</div>

<style>
  .guides {
    display: grid;
    gap: 6px;
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-2);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .guide {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  select,
  input[type='number'] {
    min-width: 0;
    flex: 1;
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

  .toggle input {
    margin: 0;
  }
</style>
