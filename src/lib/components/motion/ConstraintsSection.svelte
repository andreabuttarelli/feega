<script lang="ts">
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import type { OpResult } from '$lib/motion/timeline';
  import { HORIZONTALS, Horizontal, VERTICALS, Vertical } from '$lib/motion/constraints/model';
  import { setConstraints } from '$lib/motion/constraints/constraints';

  let { doc, clip, onchange }: { doc: MotionDoc; clip: MotionClip; onchange: (result: OpResult, summary: string) => void } = $props();

  const LABEL: Record<Horizontal | Vertical, string> = {
    [Horizontal.Left]: 'Left',
    [Horizontal.Right]: 'Right',
    [Horizontal.LeftRight]: 'Left and right',
    [Horizontal.Center]: 'Centre',
    [Horizontal.Scale]: 'Scale',
    [Vertical.Top]: 'Top',
    [Vertical.Bottom]: 'Bottom',
    [Vertical.TopBottom]: 'Top and bottom'
  };

  const horizontal = $derived(clip.constraints?.horizontal ?? Horizontal.Scale);
  const vertical = $derived(clip.constraints?.vertical ?? Vertical.Scale);
</script>

<div class="constraints" data-testid="constraints-section">
  <span class="head">Constraints</span>
  <label>
    <span>Horizontal</span>
    <select value={horizontal} onchange={(e) => onchange(setConstraints(doc, [clip.id], { horizontal: e.currentTarget.value as Horizontal }), 'Changed the horizontal constraint')} data-testid="constraint-horizontal">
      {#each HORIZONTALS as h (h)}<option value={h}>{LABEL[h]}</option>{/each}
    </select>
  </label>
  <label>
    <span>Vertical</span>
    <select value={vertical} onchange={(e) => onchange(setConstraints(doc, [clip.id], { vertical: e.currentTarget.value as Vertical }), 'Changed the vertical constraint')} data-testid="constraint-vertical">
      {#each VERTICALS as v (v)}<option value={v}>{LABEL[v]}</option>{/each}
    </select>
  </label>
</div>

<style>
  .constraints {
    display: grid;
    gap: 6px;
    padding: var(--ui-space-2) 0;
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-2);
  }

  .head {
    color: var(--ui-ink);
  }

  label {
    display: grid;
    grid-template-columns: 88px minmax(0, 1fr);
    align-items: center;
    gap: var(--ui-space-2);
  }

  select {
    width: 100%;
    height: 28px;
    padding: 0 8px;
    border: 1px solid transparent;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-ink);
    font: inherit;
  }
</style>
