<script lang="ts">
  import { PIXEL_ROWS, pixelCells, type PixelIcon } from './pixel';

  let { icon, size = 4 }: { icon: PixelIcon; size?: number } = $props();

  const rows = $derived(PIXEL_ROWS[icon]);
  const cells = $derived(pixelCells(rows));
  const width = $derived(Math.max(...rows.map((r) => r.length)));
</script>

<svg class="pixel" width={width * size} height={rows.length * size} viewBox={`0 0 ${width} ${rows.length}`} shape-rendering="crispEdges" aria-hidden="true">
  {#each cells as c (`${c.x}-${c.y}`)}<rect x={c.x} y={c.y} width="1" height="1" fill={c.fill} />{/each}
</svg>
