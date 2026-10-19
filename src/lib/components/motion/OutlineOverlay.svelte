<script lang="ts">
  import type { MotionDoc } from '$lib/motion/doc';
  import type { Boxes } from '$lib/motion/scene-select';
  import { outlinePaths } from '$lib/motion/outline-view';

  let { doc, frame, boxes }: { doc: MotionDoc; frame: number; boxes: Boxes } = $props();

  const paths = $derived(outlinePaths(doc, frame, boxes));
</script>

<svg class="outlines" data-testid="outline-view" viewBox={`0 0 ${doc.width} ${doc.height}`} preserveAspectRatio="none" aria-hidden="true">
  <rect class="sheet" width={doc.width} height={doc.height} />
  {#each paths as p (p.id)}<path class="line" data-outline={p.id} d={p.d} />{/each}
</svg>

<style>
  .outlines {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .sheet {
    fill: var(--ui-bg);
  }

  .line {
    fill: none;
    fill-rule: evenodd;
    stroke: var(--ui-ink);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
</style>
