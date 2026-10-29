<script lang="ts">
  import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
  import type { Boxes } from '$lib/motion/scene-select';
  import { outlinePaths } from '$lib/motion/outline-view';
  import { onionFrames } from '$lib/motion/motion-trail';

  let { doc, clip, frame, boxes }: { doc: MotionDoc; clip: MotionClip; frame: number; boxes: Boxes } = $props();

  const ghosts = $derived(onionFrames(clip, frame).flatMap((at) => outlinePaths(doc, at, boxes).filter((p) => p.id === clip.id).map((p) => ({ at, d: p.d }))));
</script>

<svg class="onion" data-testid="onion-skin" viewBox={`0 0 ${doc.width} ${doc.height}`} preserveAspectRatio="none" aria-hidden="true">
  {#each ghosts as g (g.at)}<path class="ghost" data-onion-frame={g.at} d={g.d} />{/each}
</svg>

<style>
  .onion {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
  }

  .ghost {
    fill: var(--ui-accent);
    fill-opacity: 0.08;
    stroke: var(--ui-accent);
    stroke-opacity: 0.45;
    stroke-width: 1;
    stroke-dasharray: 4 3;
    vector-effect: non-scaling-stroke;
  }
</style>
