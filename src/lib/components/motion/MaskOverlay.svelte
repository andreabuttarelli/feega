<script lang="ts">
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { MaskKind } from '$lib/motion/mask';
  import { CORNERS, Grab, cornerAt, dragBox, dragPoint, editMaskAt, maskBox, pointAt, type MaskBox } from '$lib/motion/mask-handles';
  import { setMask, type OpResult } from '$lib/motion/timeline';

  let { doc, clip, frame, onchange }: { doc: MotionDoc; clip: MotionClip; frame: number; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  type Drag = { grab: Grab | number; x: number; y: number; box: MaskBox; points: [number, number][] };

  let host = $state<HTMLDivElement | null>(null);
  let drag = $state<Drag | null>(null);
  let live = $state<{ box: MaskBox; points: [number, number][] } | null>(null);

  const size = $derived({ width: doc.width, height: doc.height });
  const box = $derived(live?.box ?? maskBox(clip, frame));
  const points = $derived(live?.points ?? clip.mask?.points ?? []);
  const polygon = $derived(clip.mask?.kind === MaskKind.Polygon);
  const corners = Object.keys(CORNERS) as Exclude<Grab, Grab.Body>[];

  const pct = (p: { x: number; y: number }) => `left: ${(p.x / size.width) * 100}%; top: ${(p.y / size.height) * 100}%;`;
  const outline = (b: MaskBox) => corners.map((c) => cornerAt(b, c, size)).map((p) => `${p.x},${p.y}`).join(' ');

  function start(e: PointerEvent, grab: Grab | number) {
    if (!box) {
      return;
    }
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag = { grab, x: e.clientX, y: e.clientY, box, points: [...points] };
  }

  function move(e: PointerEvent) {
    if (!drag || !host) {
      return;
    }
    const rect = host.getBoundingClientRect();
    const delta = { dx: (e.clientX - drag.x) / rect.width, dy: (e.clientY - drag.y) / rect.height };
    live =
      typeof drag.grab === 'number'
        ? { box: drag.box, points: dragPoint(drag.points, drag.grab, drag.box, delta, size) }
        : { box: dragBox(drag.box, drag.grab, delta, size), points: drag.points };
  }

  function commit(result: OpResult, summary: string) {
    if (result.ok) {
      onchange(result.doc, summary);
    }
  }

  function end() {
    const done = live;
    const grab = drag?.grab;
    drag = null;
    live = null;
    if (!done || !clip.mask || grab === undefined) {
      return;
    }
    if (typeof grab === 'number') {
      commit(setMask(doc, clip.id, { ...clip.mask, points: done.points }), 'Moved a mask point');
      return;
    }
    const { x, y, width, height } = done.box;
    commit(editMaskAt(doc, clip, grab === Grab.Body ? { x, y } : { x, y, width, height }, frame), grab === Grab.Body ? 'Moved the mask' : 'Resized the mask');
  }
</script>

{#if box}
  <div class="overlay" bind:this={host} data-testid="mask-overlay" role="presentation" onpointermove={move} onpointerup={end} onpointercancel={end}>
    <svg viewBox={`0 0 ${size.width} ${size.height}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon class="frame" points={outline(box)} />
      {#if polygon}
        <polygon class="shape" points={points.map((p) => pointAt(box, p, size)).map((p) => `${p.x},${p.y}`).join(' ')} />
      {/if}
    </svg>
    <button type="button" class="body" aria-label="Move mask" style={pct(pointAt(box, [0.5, 0.5], size))} onpointerdown={(e) => start(e, Grab.Body)}></button>
    {#each corners as corner (corner)}
      <button type="button" class="handle" aria-label={`Resize mask ${corner}`} data-grab={corner} style={pct(cornerAt(box, corner, size))} onpointerdown={(e) => start(e, corner)}></button>
    {/each}
    {#if polygon}
      {#each points as point, i (i)}
        <button type="button" class="handle point" aria-label={`Mask point ${i + 1}`} data-point={i} style={pct(pointAt(box, point, size))} onpointerdown={(e) => start(e, i)}></button>
      {/each}
    {/if}
  </div>
{/if}

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

  .frame,
  .shape {
    fill: none;
    stroke: #a855f7;
    stroke-width: 1.5px;
    vector-effect: non-scaling-stroke;
  }

  .frame {
    stroke-dasharray: 4 3;
  }

  button {
    position: absolute;
    transform: translate(-50%, -50%);
    pointer-events: all;
    padding: 0;
  }

  .handle {
    width: 10px;
    height: 10px;
    background: #fff;
    border: 1.5px solid #a855f7;
    cursor: nwse-resize;
  }

  .point {
    background: #a855f7;
    cursor: move;
  }

  .body {
    width: 18px;
    height: 18px;
    background: color-mix(in srgb, #a855f7 35%, transparent);
    border: 1.5px solid #a855f7;
    cursor: move;
  }
</style>
