<script lang="ts">
  import { hostFraction, hostWidth } from '$lib/motion/overlay-point';
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { mapOutline, parsePath, pathData, type Outline, type Pt } from '$lib/motion/shape/geometry';
  import { Handle, Mirror, addPoint, deletePoint, dragHandle, insertPoint, movePoint, segmentHit, toggleClosed, toggleSmooth, type PointRef } from '$lib/motion/shape/pen';
  import { setPath } from '$lib/motion/shape/ops';
  import { pathSpace } from '$lib/motion/shape/space';
  import { isTyping } from '$lib/motion/shortcuts';
  import type { Guide } from '$lib/motion/scene-select';
  import { pointBounds, snapPoint, snapReach, snapTargets } from '$lib/motion/shape/vector-edit';

  let { doc, clip, frame, onchange, onexit }: { doc: MotionDoc; clip: MotionClip; frame: number; onchange: (doc: MotionDoc, summary: string) => void; onexit: () => void } = $props();

  type Grab = { kind: 'point'; ref: PointRef; from: Pt; origin: Pt } | { kind: 'handle'; ref: PointRef; handle: Handle } | { kind: 'new'; ref: PointRef };

  let host = $state<HTMLDivElement | null>(null);
  let pen = $state(false);
  let selected = $state<PointRef | null>(null);
  let grab = $state<Grab | null>(null);
  let live = $state<Outline | null>(null);
  let guides = $state<Guide[]>([]);

  const space = $derived(pathSpace(doc, clip.id, frame));
  const saved = $derived.by(() => {
    const parsed = parsePath(String(clip.props.path ?? ''));
    return typeof parsed === 'string' ? [] : parsed;
  });
  const outline = $derived(live ?? saved);

  const HIT_SCREEN_PX = 8;
  const UNIT_BOX: Pt[] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const framed = $derived(mapOutline(outline, space.toFrame));

  const toFrame = (p: Pt) => {
    const [x, y] = space.toFrame(p);
    return { x, y };
  };
  const pct = (p: Pt) => {
    const f = toFrame(p);
    return `left: ${(f.x / doc.width) * 100}%; top: ${(f.y / doc.height) * 100}%;`;
  };

  function local(e: PointerEvent): Pt {
    const at = hostFraction(e, host!);
    const fx = at.x * doc.width;
    const fy = at.y * doc.height;
    return space.toLocal([fx, fy]);
  }

  function commit(next: Outline, summary: string) {
    const result = setPath(doc, clip.id, pathData(next));
    if (result.ok) {
      onchange(result.doc, summary);
    }
  }

  function startPoint(e: PointerEvent, ref: PointRef) {
    e.stopPropagation();
    selected = ref;
    if (e.altKey) {
      commit(toggleSmooth(outline, ref), 'Toggled a point between corner and smooth');
      return;
    }
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    grab = { kind: 'point', ref, from: local(e), origin: outline[ref.contour].vertices[ref.index].p };
  }

  function startHandle(e: PointerEvent, ref: PointRef, handle: Handle) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    grab = { kind: 'handle', ref, handle };
  }

  function insertOnPath(e: PointerEvent) {
    const fraction = hostFraction(e, host!);
    const at: Pt = [fraction.x * doc.width, fraction.y * doc.height];
    const hit = segmentHit(framed, at, (HIT_SCREEN_PX * doc.width) / Math.max(hostWidth(host!), 1));
    if (!hit) {
      return;
    }
    e.stopPropagation();
    const next = insertPoint(outline, hit);
    selected = next.ref;
    commit(next.outline, 'Added a path point');
  }

  function keys(e: KeyboardEvent) {
    if (isTyping(e.target as HTMLElement | null)) {
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (pen) {
        pen = false;
        return;
      }
      onexit();
      return;
    }
    if (!selected || (e.key !== 'Backspace' && e.key !== 'Delete')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    commit(deletePoint(outline, selected), 'Deleted a path point');
    selected = null;
  }

  function pressOutside(e: PointerEvent) {
    const target = e.target as Element | null;
    if (pen || !target || target.closest('[data-vector-edit]') || !host?.parentElement?.contains(target)) {
      return;
    }
    onexit();
  }

  const targets = $derived(snapTargets(doc, clip.id, frame));

  function snapped(raw: Pt, held: PointRef, e: PointerEvent): Pt {
    if (e.metaKey || e.ctrlKey) {
      guides = [];
      return raw;
    }
    const own = saved.flatMap((c, ci) => c.vertices.flatMap((v, vi) => (ci === held.contour && vi === held.index ? [] : [pointBounds(space.toFrame(v.p))])));
    const result = snapPoint(space.toFrame(raw), [...targets, ...own], { width: doc.width, height: doc.height }, snapReach(doc.width, hostWidth(host!)));
    guides = result.guides;
    return space.toLocal(result.point);
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
      const to = snapped([grab.origin[0] + at[0] - grab.from[0], grab.origin[1] + at[1] - grab.from[1]], grab.ref, e);
      live = movePoint(saved, grab.ref, [to[0] - grab.origin[0], to[1] - grab.origin[1]]);
      return;
    }
    live = dragHandle(live ?? saved, grab.ref, grab.kind === 'handle' ? grab.handle : Handle.Out, at, e.altKey ? Mirror.Broken : Mirror.Mirrored);
  }

  function end() {
    const done = live;
    const kind = grab?.kind;
    grab = null;
    live = null;
    guides = [];
    if (done && kind) {
      commit(done, kind === 'new' ? 'Added a path point' : 'Edited the path');
    }
  }

  const handles = (ref: PointRef) => {
    const v = outline[ref.contour]?.vertices[ref.index];
    return v ? ([[Handle.In, v.in], [Handle.Out, v.out]] as [Handle, Pt][]).filter(([, h]) => h[0] !== v.p[0] || h[1] !== v.p[1]) : [];
  };
</script>

<svelte:window onkeydowncapture={keys} onpointerdowncapture={pressOutside} />

<div class="overlay" class:pen bind:this={host} data-vector-edit data-testid="pen-overlay" role="presentation" onpointerdown={place} onpointermove={move} onpointerup={end} onpointercancel={end}>
  <svg viewBox={`0 0 ${doc.width} ${doc.height}`} preserveAspectRatio="none" aria-hidden="true">
    <polygon class="frame" points={UNIT_BOX.map((p) => space.toFrame(p).join(',')).join(' ')} />
    <path class="outline" d={pathData(framed)} />
    {#each guides as g (g.axis + g.at)}
      {#if g.axis === 'x'}<line class="guide" x1={g.at} y1="0" x2={g.at} y2={doc.height} />{:else}<line class="guide" x1="0" y1={g.at} x2={doc.width} y2={g.at} />{/if}
    {/each}
    <path class="hit" role="presentation" data-testid="pen-path" d={pathData(framed)} onpointerdown={insertOnPath} />
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
      <button type="button" data-drawn-small class="point" class:sel={selected?.contour === ci && selected?.index === vi} aria-label={`Path point ${ci + 1}.${vi + 1}`} data-point={`${ci}.${vi}`} style={pct(v.p)} onpointerdown={(e) => startPoint(e, { contour: ci, index: vi })}></button>
    {/each}
  {/each}
  {#if selected}
    {#each handles(selected) as [which, h] (which)}
      <button type="button" data-drawn-small class="handle" aria-label={`Bezier handle ${which}`} style={pct(h)} onpointerdown={(e) => startHandle(e, selected!, which)}></button>
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

  .guide {
    stroke: #ff3d7f;
    stroke-width: 1px;
    vector-effect: non-scaling-stroke;
  }

  .frame,
  .outline,
  .arm {
    fill: none;
    stroke: var(--ui-accent);
    stroke-width: 1.5px;
    vector-effect: non-scaling-stroke;
  }

  .hit {
    fill: none;
    stroke: transparent;
    stroke-width: 12px;
    vector-effect: non-scaling-stroke;
    pointer-events: stroke;
    cursor: copy;
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

  @media (pointer: coarse) {
    [data-drawn-small]::before {
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
