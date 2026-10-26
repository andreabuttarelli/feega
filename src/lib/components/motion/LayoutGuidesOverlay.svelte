<script lang="ts">
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import { guideBands, guideLines } from '$lib/motion/layout-guides/guides';

  let { doc }: { doc: MotionDoc } = $props();

  const shown = $derived((doc.layoutGuides ?? []).filter((g) => !g.hidden));
  const drawn = $derived(shown.map((g) => ({ color: g.color, opacity: g.opacity, bands: guideBands(g, doc), lines: guideLines(g, doc) })));
</script>

<svg class="guides" data-testid="layout-guides" viewBox={`0 0 ${doc.width} ${doc.height}`} preserveAspectRatio="none" aria-hidden="true">
  {#each drawn as g, n (n)}
    {#each g.bands as b, i (i)}<rect x={b.left} y={b.top} width={b.width} height={b.height} fill={g.color} fill-opacity={g.opacity} />{/each}
    {#each g.lines as l, i (i)}
      {#if l.axis === 'x'}<line class="line" x1={l.at} y1="0" x2={l.at} y2={doc.height} stroke={g.color} stroke-opacity={g.opacity * 3.5} />{:else}<line class="line" x1="0" y1={l.at} x2={doc.width} y2={l.at} stroke={g.color} stroke-opacity={g.opacity * 3.5} />{/if}
    {/each}
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

  .line {
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
</style>
