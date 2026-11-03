<script lang="ts">
  import { hostFraction } from '$lib/motion/overlay-point';
  import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
  import { corner, pathData, type Pt } from '@feega/motion-core/motion/shape/geometry';
  import { setPath } from '$lib/motion/shape/ops';
  import { pathSpace } from '@feega/motion-core/motion/shape/space';
  import { lineEnds, type LineEnds } from '$lib/motion/shape/line-ends';

  let { doc, clip, frame, onchange }: { doc: MotionDoc; clip: MotionClip; frame: number; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  const EIGHTH_TURN = Math.PI / 4;
  const ENDS = [0, 1] as const;

  let host = $state<HTMLDivElement | null>(null);
  let held = $state<0 | 1 | null>(null);
  let live = $state<LineEnds | null>(null);

  const space = $derived(pathSpace(doc, clip.id, frame));
  const ends = $derived(live ?? lineEnds(clip));
  const framed = $derived(ends ? ends.map((p) => space.toFrame(p)) : []);
  const pct = ([x, y]: Pt) => `left:${(x / doc.width) * 100}%;top:${(y / doc.height) * 100}%`;

  function toward(from: Pt, to: Pt): Pt {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const angle = Math.round(Math.atan2(dy, dx) / EIGHTH_TURN) * EIGHTH_TURN;
    const length = Math.hypot(dx, dy);
    return [from[0] + Math.cos(angle) * length, from[1] + Math.sin(angle) * length];
  }

  function pointAt(e: PointerEvent, other: Pt): Pt {
    const at = hostFraction(e, host!);
    const inFrame: Pt = [at.x * doc.width, at.y * doc.height];
    return space.toLocal(e.shiftKey ? toward(space.toFrame(other), inFrame) : inFrame);
  }

  function press(e: PointerEvent, end: 0 | 1) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    held = end;
  }

  function drag(e: PointerEvent) {
    const start = lineEnds(clip);
    if (held === null || !start) {
      return;
    }
    const next: LineEnds = [...start];
    next[held] = pointAt(e, start[1 - held]);
    live = next;
  }

  function release() {
    const done = live;
    held = null;
    live = null;
    if (!done) {
      return;
    }
    const result = setPath(doc, clip.id, pathData([{ vertices: done.map(corner), closed: false }]));
    if (result.ok) {
      onchange(result.doc, 'Moved a line end');
    }
  }
</script>

<div class="overlay" bind:this={host} data-testid="line-ends">
  {#if live && framed.length}
    <svg viewBox={`0 0 ${doc.width} ${doc.height}`} preserveAspectRatio="none" aria-hidden="true">
      <line x1={framed[0][0]} y1={framed[0][1]} x2={framed[1][0]} y2={framed[1][1]} />
    </svg>
  {/if}
  {#each ENDS as end (end)}
    {#if framed[end]}
      <div class="end" data-testid="line-end" data-end={end} style={pct(framed[end])} role="presentation" onpointerdown={(e) => press(e, end)} onpointermove={drag} onpointerup={release} onpointercancel={release}></div>
    {/if}
  {/each}
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  line {
    stroke: var(--ui-accent);
    stroke-width: 1.5px;
    vector-effect: non-scaling-stroke;
  }

  .end {
    position: absolute;
    width: 9px;
    height: 9px;
    transform: translate(-50%, -50%);
    background: var(--ui-bg, #fff);
    border: 1.5px solid var(--ui-accent);
    border-radius: var(--ui-radius-full, 9999px);
    pointer-events: all;
    cursor: crosshair;
  }
</style>
