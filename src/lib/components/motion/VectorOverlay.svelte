<script lang="ts">
  import { hostFraction, hostWidth } from '$lib/motion/overlay-point';
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { pathData, type Pt } from '$lib/motion/shape/geometry';
  import { pathSpace } from '$lib/motion/shape/space';
  import { isTyping } from '$lib/motion/shortcuts';
  import { EMPTY_NETWORK, networkSchema, type Vector, type VectorNetwork } from '$lib/motion/vector/model';
  import { networkStroke } from '$lib/motion/vector/outline';
  import { nearestOnNetwork } from '$lib/motion/vector/curve-math';
  import { Tangent, breakAtVertex, deleteVertex, handlesAt, removeVertex, splitSegmentAt, toggleSmoothVertex, type Handle } from '$lib/motion/vector/edit';
  import { addVertex, connect, fillClosed, moveVertex, setTangent } from '$lib/motion/vector/draw';
  import { setNetwork } from '$lib/motion/vector/ops';
  import type { Guide } from '$lib/motion/scene-select';
  import { pointBounds, snapPoint, snapReach, snapTargets } from '$lib/motion/shape/vector-edit';

  let { doc, clip, frame, onchange, onexit }: { doc: MotionDoc; clip: MotionClip; frame: number; onchange: (doc: MotionDoc, summary: string) => void; onexit: () => void } = $props();

  type Grab = { kind: 'vertex'; vertex: number; from: Vector; base: VectorNetwork } | { kind: 'handle'; handle: Handle; base: VectorNetwork };

  const HIT_SCREEN_PX = 8;
  const UNIT_BOX: Pt[] = [[0, 0], [1, 0], [1, 1], [0, 1]];

  let host = $state<HTMLDivElement | null>(null);
  let pen = $state(false);
  let selected = $state<number | null>(null);
  let grab = $state<Grab | null>(null);
  let live = $state.raw<VectorNetwork | null>(null);
  let guides = $state<Guide[]>([]);

  const space = $derived(pathSpace(doc, clip.id, frame));
  const saved = $derived.by(() => {
    const parsed = networkSchema.safeParse(clip.props.network);
    return parsed.success ? parsed.data : EMPTY_NETWORK;
  });
  const network = $derived(live ?? saved);
  const framedStroke = $derived(pathData(networkStroke(network).map((c) => ({ ...c, vertices: c.vertices.map((v) => ({ p: space.toFrame(v.p), in: space.toFrame(v.in), out: space.toFrame(v.out) })) }))));

  const toFrame = (v: Vector) => {
    const [x, y] = space.toFrame([v.x, v.y]);
    return { x, y };
  };
  const pct = (v: Vector) => {
    const f = toFrame(v);
    return `left: ${(f.x / doc.width) * 100}%; top: ${(f.y / doc.height) * 100}%;`;
  };
  const handlePoint = (h: Handle): Vector => {
    const s = network.segments[h.segmentIndex];
    const at = network.vertices[h.tangent === Tangent.Start ? s.start : s.end];
    return { x: at.x + s[h.tangent].x, y: at.y + s[h.tangent].y };
  };
  const shownHandles = $derived(selected === null ? [] : handlesAt(network, selected));

  function local(e: PointerEvent): Vector {
    const at = hostFraction(e, host!);
    const [x, y] = space.toLocal([at.x * doc.width, at.y * doc.height]);
    return { x, y };
  }

  function commit(next: VectorNetwork | null, summary: string) {
    const result = next ? setNetwork(doc, clip.id, next) : null;
    if (result?.ok) {
      onchange(result.doc, summary);
    }
  }

  function pressVertex(e: PointerEvent, vertex: number) {
    e.stopPropagation();
    if (pen && selected !== null && selected !== vertex) {
      commit(connect(network, selected, vertex), 'Joined two points');
      selected = vertex;
      return;
    }
    selected = vertex;
    if (e.altKey) {
      commit(toggleSmoothVertex(network, vertex), 'Toggled a point between corner and smooth');
      return;
    }
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    grab = { kind: 'vertex', vertex, from: local(e), base: network };
  }

  function pressHandle(e: PointerEvent, handle: Handle) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    grab = { kind: 'handle', handle, base: network };
  }

  function pressSegment(e: PointerEvent) {
    const hit = nearestOnNetwork(local(e), network, HIT_SCREEN_PX / Math.max(hostWidth(host!), 1));
    if (!hit) {
      return;
    }
    e.stopPropagation();
    const split = splitSegmentAt(network, hit.segmentIndex, hit.t);
    selected = split.vertex;
    commit(split.network, 'Added a point');
  }

  function pressOutside(e: PointerEvent) {
    const target = e.target as Element | null;
    if (pen || !target || target.closest('[data-vector-edit]') || !host?.parentElement?.contains(target)) {
      return;
    }
    onexit();
  }

  const targets = $derived(snapTargets(doc, clip.id, frame));

  function snapped(raw: Vector, held: number, e: PointerEvent): Vector {
    if (e.metaKey || e.ctrlKey) {
      guides = [];
      return raw;
    }
    const own = saved.vertices.flatMap((v, i) => (i === held ? [] : [pointBounds(space.toFrame([v.x, v.y]))]));
    const result = snapPoint(space.toFrame([raw.x, raw.y]), [...targets, ...own], { width: doc.width, height: doc.height }, snapReach(doc.width, hostWidth(host!)));
    guides = result.guides;
    const [x, y] = space.toLocal(result.point);
    return { x, y };
  }

  function place(e: PointerEvent) {
    if (!pen) {
      return;
    }
    const made = addVertex(network, selected, local(e));
    selected = made.vertex;
    commit(made.network, 'Drew a point');
  }

  function move(e: PointerEvent) {
    if (!grab) {
      return;
    }
    const at = local(e);
    if (grab.kind === 'vertex') {
      const origin = grab.base.vertices[grab.vertex];
      const to = snapped({ x: origin.x + at.x - grab.from.x, y: origin.y + at.y - grab.from.y }, grab.vertex, e);
      live = moveVertex(grab.base, grab.vertex, { x: to.x - origin.x, y: to.y - origin.y });
      return;
    }
    const s = grab.base.segments[grab.handle.segmentIndex];
    const owner = grab.base.vertices[grab.handle.tangent === Tangent.Start ? s.start : s.end];
    live = setTangent(grab.base, grab.handle.segmentIndex, grab.handle.tangent, { x: at.x - owner.x, y: at.y - owner.y });
  }

  function end() {
    const done = live;
    const kind = grab?.kind;
    grab = null;
    live = null;
    guides = [];
    if (done && kind) {
      commit(done, kind === 'vertex' ? 'Moved a point' : 'Bent a curve');
    }
  }

  function key(e: KeyboardEvent) {
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
    if (selected === null || (e.key !== 'Backspace' && e.key !== 'Delete')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    commit(e.altKey ? deleteVertex(network, selected) : removeVertex(network, selected), 'Deleted a point');
    selected = null;
  }
</script>

<svelte:window onkeydowncapture={key} onpointerdowncapture={pressOutside} />

<div class="overlay" class:pen bind:this={host} data-vector-edit data-testid="vector-overlay" role="presentation" onpointerdown={place} onpointermove={move} onpointerup={end} onpointercancel={end}>
  <svg viewBox={`0 0 ${doc.width} ${doc.height}`} preserveAspectRatio="none" aria-hidden="true">
    <polygon class="frame" points={UNIT_BOX.map((p) => space.toFrame(p).join(',')).join(' ')} />
    <path class="outline" d={framedStroke} />
    {#each guides as g (g.axis + g.at)}
      {#if g.axis === 'x'}<line class="guide" x1={g.at} y1="0" x2={g.at} y2={doc.height} />{:else}<line class="guide" x1="0" y1={g.at} x2={doc.width} y2={g.at} />{/if}
    {/each}
    <path class="hit" role="presentation" data-testid="vector-segments" d={framedStroke} onpointerdown={pressSegment} />
    {#if selected !== null}
      {#each shownHandles as h (`${h.segmentIndex}-${h.tangent}`)}
        {@const a = toFrame(network.vertices[selected])}
        {@const b = toFrame(handlePoint(h))}
        <line class="arm" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      {/each}
    {/if}
  </svg>
  <div class="tools" role="toolbar" aria-label="Vector tools">
    <button type="button" class:on={pen} aria-pressed={pen} data-testid="vector-pen" onpointerdown={(e) => e.stopPropagation()} onclick={() => (pen = !pen)}>Pen</button>
    <button type="button" data-testid="vector-fill" onpointerdown={(e) => e.stopPropagation()} onclick={() => commit(fillClosed(network), 'Filled the closed shapes')}>Fill</button>
    <button type="button" disabled={selected === null} onpointerdown={(e) => e.stopPropagation()} onclick={() => selected !== null && commit(breakAtVertex(network, selected), 'Broke the path')}>Break</button>
    <button
      type="button"
      disabled={selected === null}
      onpointerdown={(e) => e.stopPropagation()}
      onclick={() => {
        if (selected !== null) {
          commit(removeVertex(network, selected), 'Deleted a point');
          selected = null;
        }
      }}>Delete point</button>
  </div>
  {#each network.vertices as v, i (i)}
    <button type="button" data-drawn-small class="point" class:sel={selected === i} aria-label={`Vector point ${i + 1}`} data-vertex={i} style={pct(v)} onpointerdown={(e) => pressVertex(e, i)}></button>
  {/each}
  {#each shownHandles as h (`${h.segmentIndex}-${h.tangent}`)}
    <button type="button" data-drawn-small class="handle" aria-label="Curve handle" data-handle={`${h.segmentIndex}-${h.tangent}`} style={pct(handlePoint(h))} onpointerdown={(e) => pressHandle(e, h)}></button>
  {/each}
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
