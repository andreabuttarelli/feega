<script lang="ts">
  import { findClip, type MotionClip, type MotionDoc } from '$lib/motion/doc';
  import type { MeasuredBox } from '$lib/motion/hyperframes/measure';
  import { selectionView } from '$lib/motion/selection-context';
  import type { ComponentId } from '$lib/motion/components';
  import type { Transform } from '$lib/motion/keyframes';
  import { Grip, PickMode, aabb, anchorOf, dragPatch, handlesOf, pick, quadOf, readout, stackAt, writePatch, type Boxes, type Guide, type Pt, type Quad } from '$lib/motion/scene-select';

  let {
    doc,
    frame,
    html,
    measure,
    onpreview,
    onchange
  }: {
    doc: MotionDoc;
    frame: number;
    html: string;
    measure: () => Promise<Record<string, MeasuredBox>>;
    onpreview: (doc: MotionDoc | null) => void;
    onchange: (doc: MotionDoc, summary: string) => void;
  } = $props();

  const shared = selectionView()!;
  const selection = $derived(shared.ids);
  const onselect = (ids: string[]) => shared.select(ids);

  const SNAP_SCREEN_PX = 8;
  const SETTLE_MS = 300;
  const EMPTY_RETRIES = 20;
  const ROTATE_REACH_PX = 44;

  const SUMMARY: Record<Grip, string> = {
    [Grip.Move]: 'Moved in the preview',
    [Grip.Scale]: 'Scaled in the preview',
    [Grip.Rotate]: 'Rotated in the preview',
    [Grip.Anchor]: 'Moved the anchor point'
  };

  type Grab = { grip: Grip; handle: number; clipId: string; from: Pt; pointer: number };

  let host = $state<HTMLDivElement | null>(null);
  let boxes = $state<Boxes>({});
  let hover = $state<string | null>(null);
  let grab = $state<Grab | null>(null);
  let live = $state<{ doc: MotionDoc; patch: Transform; guides: Guide[] } | null>(null);

  const shown = $derived(live?.doc ?? doc);
  const selected = $derived(selection.length === 1 ? selection[0] : null);
  const clip = $derived<MotionClip | null>(selected ? (findClip(shown, selected)?.clip ?? null) : null);
  const onFrame = (c: MotionClip) => frame >= c.from && frame < c.from + c.durationInFrames;
  const quad = $derived(clip && boxes[clip.id] && onFrame(clip) ? quadOf(shown, clip.id, frame, boxes[clip.id]) : null);
  const hoverQuad = $derived(hover && hover !== selected && boxes[hover] ? quadOf(shown, hover, frame, boxes[hover]) : null);
  const anchor = $derived(quad && clip ? anchorOf(shown, clip.id, frame) : null);

  let asked = 0;

  async function remeasure(retries = EMPTY_RETRIES) {
    const ticket = ++asked;
    const measured = await measure();
    if (ticket !== asked || grab) {
      return;
    }
    if (!Object.keys(measured).length && retries > 0) {
      setTimeout(() => ticket === asked && void remeasure(retries - 1), SETTLE_MS);
    }
    boxes = Object.fromEntries(
      Object.entries(measured).map(([id, b]) => [id, { left: b.left * doc.width, top: b.top * doc.height, width: b.width * doc.width, height: b.height * doc.height }])
    );
  }

  $effect(() => {
    void html;
    void frame;
    void remeasure();
    const later = setTimeout(() => void remeasure(), SETTLE_MS);
    return () => clearTimeout(later);
  });

  function local(e: PointerEvent): Pt {
    const rect = host!.getBoundingClientRect();
    return [((e.clientX - rect.left) / rect.width) * doc.width, ((e.clientY - rect.top) / rect.height) * doc.height];
  }

  function snapReach(): number {
    const rect = host!.getBoundingClientRect();
    return (SNAP_SCREEN_PX * doc.width) / Math.max(rect.width, 1);
  }

  function begin(e: PointerEvent, grip: Grip, handle: number, clipId: string) {
    e.stopPropagation();
    if (e.altKey && grip !== Grip.Move) {
      press(e);
      return;
    }
    host!.setPointerCapture(e.pointerId);
    grab = { grip, handle, clipId, from: local(e), pointer: e.pointerId };
  }

  function press(e: PointerEvent) {
    const p = local(e);
    const next = pick(stackAt(doc, frame, boxes, p), selected, e.altKey ? PickMode.Beneath : PickMode.Top);
    if (!next) {
      onselect([]);
      return;
    }
    if (next !== selected) {
      onselect([next]);
    }
    begin(e, Grip.Move, 0, next);
  }

  function others(clipId: string) {
    return Object.keys(boxes)
      .filter((id) => id !== clipId && findClip(doc, id) && onFrame(findClip(doc, id)!.clip))
      .map((id) => aabb(quadOf(doc, id, frame, boxes[id])));
  }

  function move(e: PointerEvent) {
    if (!grab) {
      hover = e.pointerType === 'mouse' ? (stackAt(doc, frame, boxes, local(e))[0] ?? null) : null;
      return;
    }
    const box = boxes[grab.clipId];
    if (!box) {
      return;
    }
    const { patch, guides } = dragPatch({ doc, clipId: grab.clipId, frame, box, grip: grab.grip, handle: grab.handle, from: grab.from, to: local(e), shift: e.shiftKey, snapTargets: others(grab.clipId), snapPx: snapReach() });
    const result = writePatch(doc, grab.clipId, frame, patch);
    if (!result.ok) {
      return;
    }
    live = { doc: result.doc, patch, guides };
    onpreview(result.doc);
  }

  function end() {
    const done = live;
    const grip = grab?.grip;
    grab = null;
    live = null;
    onpreview(null);
    if (done && grip) {
      onchange(done.doc, SUMMARY[grip]);
    }
  }

  const pct = ([x, y]: Pt) => `left: ${(x / doc.width) * 100}%; top: ${(y / doc.height) * 100}%;`;
  const points = (q: Quad) => q.map((p) => p.join(',')).join(' ');

  function outward(q: Quad, corner: Pt): string {
    const cx = (q[0][0] + q[2][0]) / 2;
    const cy = (q[0][1] + q[2][1]) / 2;
    const length = Math.hypot(corner[0] - cx, corner[1] - cy) || 1;
    return `${pct(corner)} --dx: ${((corner[0] - cx) / length) * ROTATE_REACH_PX}px; --dy: ${((corner[1] - cy) / length) * ROTATE_REACH_PX}px;`;
  }
</script>

<div class="overlay" bind:this={host} data-testid="selection-overlay" role="presentation" onpointerdown={press} onpointermove={move} onpointerup={end} onpointercancel={end} onpointerleave={() => (hover = null)}>
  <svg viewBox={`0 0 ${doc.width} ${doc.height}`} preserveAspectRatio="none" aria-hidden="true">
    {#if hoverQuad && !grab}<polygon class="hover" points={points(hoverQuad)} />{/if}
    {#if quad}<polygon class="box" points={points(quad)} data-testid="selection-box" />{/if}
    {#each live?.guides ?? [] as g (g.axis + g.at)}
      {#if g.axis === 'x'}<line class="guide" x1={g.at} y1="0" x2={g.at} y2={doc.height} />{:else}<line class="guide" x1="0" y1={g.at} x2={doc.width} y2={g.at} />{/if}
    {/each}
  </svg>
  {#if quad && clip}
    {@const handles = handlesOf(quad)}
    {#each handles.slice(0, 4) as h, i (i)}
      <button type="button" class="target rotate" aria-label="Rotate" style={outward(quad, h.at)} onpointerdown={(e) => begin(e, Grip.Rotate, i, clip.id)}></button>
    {/each}
    {#each handles as h, i (i)}
      <button type="button" class="target scale" aria-label="Scale" data-handle={i} style={pct(h.at)} onpointerdown={(e) => begin(e, Grip.Scale, i, clip.id)}><span></span></button>
    {/each}
    {#if anchor}
      <button type="button" class="target anchor" aria-label="Anchor point" data-testid="selection-anchor" style={pct(anchor)} onpointerdown={(e) => begin(e, Grip.Anchor, 0, clip.id)}><span></span></button>
    {/if}
    {#if live}<output class="readout">{readout(clip.component as ComponentId, live.patch, doc)}</output>{/if}
  {/if}
</div>

<style>
  .overlay {
    position: absolute;
    inset: 0;
    touch-action: none;
  }

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
  }

  .box,
  .hover,
  .guide {
    fill: none;
    vector-effect: non-scaling-stroke;
  }

  .box {
    stroke: var(--ui-accent);
    stroke-width: 1.5px;
  }

  .hover {
    stroke: var(--ui-accent);
    stroke-width: 1px;
    opacity: 0.5;
  }

  .guide {
    stroke: #ff3d7f;
    stroke-width: 1px;
  }

  .target {
    position: absolute;
    width: 44px;
    height: 44px;
    padding: 0;
    border: none;
    background: transparent;
    transform: translate(-50%, -50%);
    display: grid;
    place-items: center;
    touch-action: none;
  }

  .target span {
    width: 9px;
    height: 9px;
    background: #fff;
    border: 1.5px solid var(--ui-accent);
  }

  .scale {
    cursor: nwse-resize;
  }

  .rotate {
    transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy)));
    cursor: grab;
  }

  .anchor {
    cursor: crosshair;
  }

  .anchor span {
    width: 11px;
    height: 11px;
    background: transparent;
    border: 1.5px solid var(--ui-accent);
    box-shadow: inset 0 0 0 3px #fff;
  }

  .readout {
    position: absolute;
    left: var(--ui-space-2);
    bottom: var(--ui-space-2);
    padding: 2px var(--ui-space-2);
    font-size: var(--ui-text-xs);
    background: var(--ui-bg);
    color: var(--ui-ink);
    border: 1px solid var(--ui-line-strong);
    pointer-events: none;
  }
</style>
