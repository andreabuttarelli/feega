<script lang="ts">
  import type { Gap, Guide, Pt } from '$lib/motion/scene-select';

  type Rect = { left: number; top: number; width: number; height: number };

  let { area, size, guides, gaps, measured }: { area: Rect; size: { width: number; height: number }; guides: Guide[]; gaps: Gap[]; measured: Gap[] } = $props();

  const pct = ([x, y]: Pt) => `left:${(x / size.width) * 100}%;top:${(y / size.height) * 100}%`;
  const middle = (g: Gap): Pt => (g.axis === 'x' ? [(g.from + g.to) / 2, g.at] : [g.at, (g.from + g.to) / 2]);
  const labelled = $derived([...gaps.map((gap) => ({ gap, testid: 'frame-gap-label' })), ...measured.map((gap) => ({ gap, testid: 'frame-measure-label' }))]);
</script>

<div class="guides" style={`left:${area.left}px;top:${area.top}px;width:${area.width}px;height:${area.height}px`}>
  <svg viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" aria-hidden="true">
    {#each guides as g (g.axis + g.at)}
      {#if g.axis === 'x'}<line class="guide" data-testid="frame-guide" x1={g.at} y1="0" x2={g.at} y2={size.height} />{:else}<line class="guide" data-testid="frame-guide" x1="0" y1={g.at} x2={size.width} y2={g.at} />{/if}
    {/each}
    {#each labelled as { gap: g } (g.axis + g.from + g.to + g.at)}
      {#if g.axis === 'x'}<line class="gap" x1={g.from} y1={g.at} x2={g.to} y2={g.at} />{:else}<line class="gap" x1={g.at} y1={g.from} x2={g.at} y2={g.to} />{/if}
    {/each}
  </svg>
  {#each labelled as { gap: g, testid } (g.axis + g.from + g.to + g.at)}
    <span class="label" data-testid={testid} style={pct(middle(g))}>{Math.round(g.to - g.from)}</span>
  {/each}
</div>

<style>
  .guides {
    position: absolute;
    pointer-events: none;
  }

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .guide,
  .gap {
    stroke: #ff3d7f;
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
  }

  .label {
    position: absolute;
    transform: translate(-50%, -50%);
    padding: 0 4px;
    border-radius: var(--ui-radius-xs, 2px);
    background: #ff3d7f;
    color: #fff;
    font-size: 10px;
    line-height: 14px;
    white-space: nowrap;
  }
</style>
