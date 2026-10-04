<script lang="ts">
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { boxOf } from '$lib/motion/layout';
  import { mapOutline, parsePath, pathData, type Outline, type Pt } from '$lib/motion/shape/geometry';
  import { Handle, Mirror, addPoint, deletePoint, dragHandle, movePoint, toggleClosed, type PointRef } from '$lib/motion/shape/pen';
  import { setPath } from '$lib/motion/shape/ops';

  let { doc, clip, onchange }: { doc: MotionDoc; clip: MotionClip; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  type Grab = { kind: 'point'; ref: PointRef; from: Pt } | { kind: 'handle'; ref: PointRef; handle: Handle } | { kind: 'new'; ref: PointRef };

  let host = $state<HTMLDivElement | null>(null);
  let pen = $state(false);
  let selected = $state<PointRef | null>(null);
  let grab = $state<Grab | null>(null);
  let live = $state<Outline | null>(null);

  const box = $derived(boxOf(clip.props as { x: number; y: number; width: number; height: number }, doc));
  const saved = $derived.by(() => {
    const parsed = parsePath(String(clip.props.path ?? ''));
    return typeof parsed === 'string' ? [] : parsed;
  });
  const outline = $derived(live ?? saved);

  const toFrame = (p: Pt) => ({ x: box.left + p[0] * box.width, y: box.top + p[1] * box.height });
  const pct = (p: Pt) => {
    const f = toFrame(p);
    return `left: ${(f.x / doc.width) * 100}%; top: ${(f.y / doc.height) * 100}%;`;
  };

  function local(e: PointerEvent): Pt {
    const rect = host!.getBoundingClientRect();
    const fx = ((e.clientX - rect.left) / rect.width) * doc.width;
    const fy = ((e.clientY - rect.top) / rect.height) * doc.height;
    return [(fx - box.left) / box.width, (fy - box.top) / box.height];
  }

  function commit(next: Outline, summary: string) {
    const result = setPath(doc, clip.id, pathData(next));
    if (result.ok) {
      onchange(result.doc, summary);
    }
  }

  function startPoint(e: PointerEvent, ref: PointRef) {
    e.stopPropagation();
    if (e.altKey) {
      commit(deletePoint(outline, ref), 'Deleted a path point');
      selected = null;
      return;
    }
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    selected = ref;
    grab = { kind: 'point', ref, from: local(e) };
  }

  function startHandle(e: PointerEvent, ref: PointRef, handle: Handle) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    grab = { kind: 'handle', ref, handle };
  }

  function place(e: PointerEvent) {
    if (!pen || !host) {
      return;
    }
    host.setPointerCapture(e.pointerId);
    const next = addPoint(outline, local(e));
    const contour = next.length - 1;
    const ref = { contour, index: next[contour].vertices.length - 1 };
    live = next;
    selected = ref;
    grab = { kind: 'new', ref };
  }

  function move(e: PointerEvent) {
    if (!grab) {
      return;
    }
    const at = local(e);
    if (grab.kind === 'point') {
      live = movePoint(saved, grab.ref, [at[0] - grab.from[0], at[1] - grab.from[1]]);
      return;
    }
    live = dragHandle(live ?? saved, grab.ref, grab.kind === 'handle' ? grab.handle : Handle.Out, at, e.altKey ? Mirror.Broken : Mirror.Mirrored);
  }

  function end() {
    const done = live;
    const kind = grab?.kind;
    grab = null;
    live = null;
    if (done && kind) {
      commit(done, kind === 'new' ? 'Added a path point' : 'Edited the path');
    }
  }

  const handles = (ref: PointRef) => {
    const v = outline[ref.contour]?.vertices[ref.index];
    return v ? ([[Handle.In, v.in], [Handle.Out, v.out]] as [Handle, Pt][]).filter(([, h]) => h[0] !== v.p[0] || h[1] !== v.p[1]) : [];
  };
</script>

<div class="overlay" class:pen bind:this={host} data-testid="pen-overlay" role="presentation" onpointerdown={place} onpointermove={move} onpointerup={end} onpointercancel={end}>
  <svg viewBox={`0 0 ${doc.width} ${doc.height}`} preserveAspectRatio="none" aria-hidden="true">
    <rect class="frame" x={box.left} y={box.top} width={box.width} height={box.height} />
    <path class="outline" d={pathData(mapOutline(outline, (p) => [box.left + p[0] * box.width, box.top + p[1] * box.height]))} />
    {#if selected}
      {#each handles(selected) as [, h] (h.join())}
        {@const a = toFrame(outline[selected.contour].vertices[selected.index].p)}
        {@const b = toFrame(h)}
        <line class="arm" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      {/each}
    {/if}
  </svg>
  <div class="tools" role="toolbar" aria-label="Path tools">
    <button type="button" class:on={pen} aria-pressed={pen} data-testid="pen-toggle" onpointerdown={(e) => e.stopPropagation()} onclick={() => (pen = !pen)}>Pen</button>
    <button type="button" disabled={!selected} onpointerdown={(e) => e.stopPropagation()} onclick={() => selected && commit(toggleClosed(outline, selected.contour), 'Closed or opened the path')}>Close / open</button>
    <button
      type="button"
      disabled={!selected}
      onpointerdown={(e) => e.stopPropagation()}
      onclick={() => {
        if (selected) {
          commit(deletePoint(outline, selected), 'Deleted a path point');
          selected = null;
        }
      }}>Delete point</button>
  </div>
  {#each outline as contour, ci (ci)}
    {#each contour.vertices as v, vi (vi)}
      <button type="button" class="point" class:sel={selected?.contour === ci && selected?.index === vi} aria-label={`Path point ${ci + 1}.${vi + 1}`} data-point={`${ci}.${vi}`} style={pct(v.p)} onpointerdown={(e) => startPoint(e, { contour: ci, index: vi })}></button>
    {/each}
  {/each}
  {#if selected}
    {#each handles(selected) as [which, h] (which)}
      <button type="button" class="handle" aria-label={`Bezier handle ${which}`} style={pct(h)} onpointerdown={(e) => startHandle(e, selected!, which)}></button>
    {/each}
  {/if}
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .overlay.pen {
    pointer-events: all;
    cursor: crosshair;
  }

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .frame,
  .outline,
  .arm {
    fill: none;
    stroke: var(--ui-accent);
    stroke-width: 1.5px;
    vector-effect: non-scaling-stroke;
  }

  .frame {
    stroke-dasharray: 4 3;
    opacity: 0.5;
  }

  .point,
  .handle {
    position: absolute;
    transform: translate(-50%, -50%);
    pointer-events: all;
    padding: 0;
    cursor: move;
  }

  .point {
    width: 9px;
    height: 9px;
    background: #fff;
    border: 1.5px solid var(--ui-accent);
  }

  .point.sel {
    background: var(--ui-accent);
  }

  .handle {
    width: 7px;
    height: 7px;
    background: var(--ui-accent);
    border: none;
  }

  .tools {
    position: absolute;
    top: var(--ui-space-2);
    left: var(--ui-space-2);
    display: flex;
    gap: var(--ui-space-1);
    pointer-events: all;
  }

  .tools button {
    font-size: var(--ui-text-xs);
    padding: 2px var(--ui-space-2);
    background: var(--ui-bg);
    border: 1px solid var(--ui-line-strong);
    color: var(--ui-ink);
  }

  .tools button.on {
    background: var(--ui-accent-wash);
    border-color: var(--ui-accent);
    color: var(--ui-accent);
  }
</style>
