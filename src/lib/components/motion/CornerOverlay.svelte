<script lang="ts">
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { boxOf } from '$lib/motion/layout';
  import { cornerInset, roundnessFromInset } from '$lib/motion/draw-tool';
  import { cornerHandleAt, cornerLocalPoint } from '$lib/motion/corner-handles';
  import { cornerRadii, withCorner, type Corners, type Pt } from '$lib/motion/shape/geometry';
  import { setProps } from '$lib/motion/timeline';
  import { hostFraction } from '$lib/motion/host-point';

  let { doc, clip, frame, onchange }: { doc: MotionDoc; clip: MotionClip; frame: number; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  const CORNERS = [0, 1, 2, 3] as const;
  const NAMES = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const;

  let host = $state<HTMLDivElement | null>(null);
  let live = $state<Corners | null>(null);
  let grab = $state<{ index: number; all: boolean } | null>(null);

  const box = $derived(boxOf(clip.props as { x: number; y: number; width: number; height: number }, doc));
  const roundness = $derived(Number(clip.props.roundness ?? 0));
  const radii = $derived(live ?? cornerRadii(roundness, (clip.props.corners as number[] | undefined) ?? []));

  function handleAt(index: number): string {
    const [x, y] = cornerHandleAt(doc, clip, frame, index, radii);
    return `left: ${(x / doc.width) * 100}%; top: ${(y / doc.height) * 100}%;`;
  }

  function local(e: PointerEvent): Pt {
    const [fx, fy] = hostFraction(host!, e);
    return cornerLocalPoint(doc, clip, frame, [fx * doc.width, fy * doc.height]);
  }

  function begin(e: PointerEvent, index: number) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    grab = { index, all: e.shiftKey };
  }

  function move(e: PointerEvent) {
    if (!grab) {
      return;
    }
    const value = roundnessFromInset(box, cornerInset(box, grab.index, local(e)));
    live = grab.all ? [value, value, value, value] : withCorner(roundness, radii, grab.index, value);
  }

  function end() {
    const done = live;
    const all = grab?.all;
    grab = null;
    live = null;
    if (!done) {
      return;
    }
    const result = setProps(doc, clip.id, all ? { roundness: done[0], corners: [] } : { corners: done });
    if (result.ok) {
      onchange(result.doc, 'Rounded a corner');
    }
  }
</script>

<div class="overlay" bind:this={host} data-testid="corner-overlay" role="presentation">
  {#each CORNERS as index (index)}
    <button type="button" class="radius" aria-label={`Round the ${NAMES[index]} corner (Shift: all)`} data-corner={index} style={handleAt(index)} onpointerdown={(e) => begin(e, index)} onpointermove={move} onpointerup={end} onpointercancel={end}></button>
  {/each}
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .radius {
    position: absolute;
    width: 8px;
    height: 8px;
    padding: 0;
    transform: translate(-50%, -50%);
    border: 1.5px solid var(--ui-accent);
    border-radius: 50%;
    background: var(--ui-bg);
    pointer-events: all;
    cursor: crosshair;
  }

  @media (pointer: coarse) {
    .radius::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 44px;
      height: 44px;
      transform: translate(-50%, -50%);
    }
  }
</style>
