<script lang="ts">
  import type { MotionDoc } from '$lib/motion/doc';
  import { guideBands, guideLines } from '$lib/motion/layout-guides/guides';

  let { doc }: { doc: MotionDoc } = $props();

  const shown = $derived((doc.layoutGuides ?? []).filter((g) => !g.hidden));
  const bands = $derived(shown.flatMap((g) => guideBands(g, doc)));
  const lines = $derived(shown.flatMap((g) => guideLines(g, doc)));
</script>

<svg class="guides" data-testid="layout-guides" viewBox={`0 0 ${doc.width} ${doc.height}`} preserveAspectRatio="none" aria-hidden="true">
  {#each bands as b, i (i)}<rect class="band" x={b.left} y={b.top} width={b.width} height={b.height} />{/each}
  {#each lines as l, i (i)}
    {#if l.axis === 'x'}<line class="line" x1={l.at} y1="0" x2={l.at} y2={doc.height} />{:else}<line class="line" x1="0" y1={l.at} x2={doc.width} y2={l.at} />{/if}
  {/each}
</svg>

<style>
  .guides {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .band {
    fill: color-mix(in oklab, var(--ui-danger) 10%, transparent);
  }

  .line {
    stroke: color-mix(in oklab, var(--ui-danger) 35%, transparent);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
</style>
