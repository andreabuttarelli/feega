<script lang="ts">
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { textPathOutline } from '$lib/motion/hyperframes/text-path';

  let { doc, clip, frame }: { doc: MotionDoc; clip: MotionClip; frame: number } = $props();

  const outline = $derived(textPathOutline(doc, clip, frame));
  const points = $derived(outline ? outline.points.map((p) => `${p[0]},${p[1]}`).join(' ') : '');
</script>

{#if outline}
  <svg class="overlay" data-testid="text-path-overlay" viewBox={`0 0 ${doc.width} ${doc.height}`} preserveAspectRatio="none" aria-hidden="true">
    {#if outline.closed}<polygon {points} />{:else}<polyline {points} />{/if}
  </svg>
{/if}

<style>
  .overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
  }

  polygon,
  polyline {
    fill: none;
    stroke: var(--ui-accent);
    stroke-width: 1.5px;
    stroke-dasharray: 6 4;
    vector-effect: non-scaling-stroke;
  }
</style>
