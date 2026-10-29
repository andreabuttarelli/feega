<script lang="ts">
  import { DEFAULT_COLOUR } from '@feega/motion-core/motion/default-colours';
  import { hostFraction, hostWidth } from '$lib/motion/overlay-point';
  import { DRAGGED_TEXT_SIZING, NEW_TEXT_SIZING } from '@feega/motion-core/motion/text-sizing';
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import { DrawTool, clickBox, closesOnFirst, dragRect, type DragPoint, type DrawBox } from '$lib/motion/draw-tool';
  import { LINE_PAINT, drawClip, lineOutline, penClip, penPaint, type LineTool } from '$lib/motion/draw-create';
  import { mapOutline, pathData, type Outline, type Pt } from '@feega/motion-core/motion/shape/geometry';
  import { smoothStroke, straightStroke } from '$lib/motion/shape/pencil';
  import { Handle, Mirror, addPoint, dragHandle, toggleClosed, type PointRef } from '$lib/motion/shape/pen';
  import type { OpResult } from '@feega/motion-core/motion/timeline';

  let {
    doc,
    frame,
    tool,
    onchange,
    oncreated
  }: {
    doc: MotionDoc;
    frame: number;
    tool: DrawTool;
    onchange: (result: OpResult, summary: string) => void;
    oncreated: (id: string) => void;
  } = $props();

  const CLOSE_REACH_PX = 8;
  const TEXT_BOX = { width: 0.4, height: 0.12 };
  const LINE_INK = DEFAULT_COLOUR.ink;
  const LINE_TOOLS: ReadonlySet<DrawTool> = new Set([DrawTool.Line, DrawTool.Arrow]);
  const MIN_LINE_PX = 2;
  const MIN_TEXT_DRAG_PX = 10;
  const PENCIL_SMOOTHING_PX = 2;

  const SUMMARY: Record<DrawTool, string> = {
    [DrawTool.Select]: '',
    [DrawTool.Text]: 'Drew a text',
    [DrawTool.Rectangle]: 'Drew a rectangle',
    [DrawTool.Ellipse]: 'Drew an ellipse',
    [DrawTool.Polygon]: 'Drew a polygon',
    [DrawTool.Star]: 'Drew a star',
    [DrawTool.Line]: 'Drew a line',
    [DrawTool.Arrow]: 'Drew an arrow',
    [DrawTool.Pen]: 'Drew a path',
    [DrawTool.Pencil]: 'Drew a path',
    [DrawTool.ShapeBuilder]: '',
    [DrawTool.Frame]: 'Drew a frame'
  };

  let host = $state<HTMLDivElement | null>(null);
  let drag = $state<{ from: DragPoint; to: DragPoint; square: boolean } | null>(null);
  let outline = $state.raw<Outline>([]);
  let grab = $state<PointRef | null>(null);
  let stroke = $state.raw<Pt[]>([]);
  let straight = $state(false);

  let held = $state.raw<DrawBox | null>(null);
  const lining = $derived(LINE_TOOLS.has(tool));
  const live = $derived(drag && !lining ? dragRect(drag.from, drag.to, drag.square) : held);
  const liveLine = $derived(drag && lining ? lineOutline(drag.from, snapped(drag.from, drag.to, drag.square), tool as LineTool) : null);

  const SNAP_STEP = Math.PI / 4;

  function snapped(from: DragPoint, to: DragPoint, snap: boolean): DragPoint {
    if (!snap) {
      return to;
    }
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const angle = Math.round(Math.atan2(to.y - from.y, to.x - from.x) / SNAP_STEP) * SNAP_STEP;
    return { x: from.x + length * Math.cos(angle), y: from.y + length * Math.sin(angle) };
  }
  const newId = () => crypto.randomUUID().slice(0, 8);

  function local(e: PointerEvent): DragPoint {
    const at = hostFraction(e, host!);
    return { x: at.x * doc.width, y: at.y * doc.height };
  }

  const docPx = (screenPx: number) => (host ? (screenPx * doc.width) / hostWidth(host) : screenPx);
  const reach = () => docPx(CLOSE_REACH_PX);
  const clickLike = (box: DrawBox) => tool === DrawTool.Text && Math.max(box.width, box.height) < docPx(MIN_TEXT_DRAG_PX);
  const unit = (box: DrawBox): DrawBox => ({ x: box.x / doc.width, y: box.y / doc.height, width: box.width / doc.width, height: box.height / doc.height });

  function create(result: OpResult, id: string) {
    onchange(result, SUMMARY[tool]);
    if (result.ok) {
      oncreated(id);
    }
  }

  function press(e: PointerEvent) {
    e.stopPropagation();
    host?.setPointerCapture(e.pointerId);
    const at = local(e);
    held = null;
    if (tool === DrawTool.Pencil) {
      stroke = [[at.x, at.y]];
      straight = e.shiftKey;
      return;
    }
    if (tool !== DrawTool.Pen) {
      drag = { from: at, to: at, square: e.shiftKey };
      return;
    }
    const p: Pt = [at.x, at.y];
    if (closesOnFirst(outline, p, reach())) {
      finish(toggleClosed(outline, outline.length - 1));
      return;
    }
    outline = addPoint(outline, p);
    const contour = outline.length - 1;
    grab = { contour, index: outline[contour].vertices.length - 1 };
  }

  function move(e: PointerEvent) {
    const at = local(e);
    if (stroke.length) {
      straight = e.shiftKey;
      stroke = [...stroke, [at.x, at.y]];
      return;
    }
    if (drag) {
      drag = { ...drag, to: at, square: e.shiftKey };
      return;
    }
    if (grab) {
      outline = dragHandle(outline, grab, Handle.Out, [at.x, at.y], e.altKey ? Mirror.Broken : Mirror.Mirrored);
    }
  }

  function release() {
    grab = null;
    if (stroke.length) {
      finishStroke();
      return;
    }
    if (!drag) {
      return;
    }
    if (lining) {
      drawLine(drag.from, snapped(drag.from, drag.to, drag.square));
      drag = null;
      return;
    }
    const dragged = live && !clickLike(live) ? live : null;
    const box = dragged ?? (tool === DrawTool.Text ? clickBox(drag.from, { width: TEXT_BOX.width * doc.width, height: TEXT_BOX.height * doc.height }) : null);
    drag = null;
    if (!box) {
      return;
    }
    held = box;
    const id = newId();
    create(drawClip(doc, tool, unit(box), frame, id, dragged ? DRAGGED_TEXT_SIZING : NEW_TEXT_SIZING), id);
  }

  function drawLine(from: DragPoint, to: DragPoint) {
    if (Math.hypot(to.x - from.x, to.y - from.y) < MIN_LINE_PX) {
      return;
    }
    const id = newId();
    const outline = mapOutline(lineOutline(from, to, tool as LineTool), ([x, y]) => [x / doc.width, y / doc.height]);
    create(penClip(doc, outline, frame, id, penPaint(LINE_PAINT[tool as LineTool](LINE_INK))), id);
  }

  const asPoint = ({ x, y }: DragPoint): Pt => [x, y];
  const asDrag = ([x, y]: Pt): DragPoint => ({ x, y });
  const strokeOutline = $derived(straight && stroke.length > 1 ? straightStroke(stroke[0], asPoint(snapped(asDrag(stroke[0]), asDrag(stroke[stroke.length - 1]), true))) : smoothStroke(stroke, docPx(PENCIL_SMOOTHING_PX)));

  function finishStroke() {
    const done = strokeOutline;
    stroke = [];
    if (done.length) {
      finish(done, penPaint(LINE_PAINT[DrawTool.Line](LINE_INK)));
    }
  }

  function finish(done: Outline, paint: Record<string, unknown> = {}) {
    outline = [];
    grab = null;
    const id = newId();
    create(penClip(doc, mapOutline(done, ([x, y]) => [x / doc.width, y / doc.height]), frame, id, paint), id);
  }

  function key(e: KeyboardEvent) {
    if (tool !== DrawTool.Pen || !outline.length || (e.key !== 'Enter' && e.key !== 'Escape')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    finish(outline);
  }
</script>

<svelte:window onkeydowncapture={key} />

<div class="draw" bind:this={host} data-testid="draw-overlay" data-tool={tool} role="presentation" onpointerdown={press} onpointermove={move} onpointerup={release} onpointercancel={release}>
  <svg viewBox={`0 0 ${doc.width} ${doc.height}`} preserveAspectRatio="none" aria-hidden="true">
    {#if live && tool === DrawTool.Ellipse}
      <ellipse class="ghost" cx={live.x} cy={live.y} rx={live.width / 2} ry={live.height / 2} />
    {:else if live}
      <rect class="ghost" x={live.x - live.width / 2} y={live.y - live.height / 2} width={live.width} height={live.height} />
    {/if}
    {#if liveLine}
      <path class="ghost" d={pathData(liveLine)} />
    {/if}
    {#if stroke.length}
      <path class="ghost" d={pathData(strokeOutline)} />
    {/if}
    {#if outline.length}
      <path class="ghost" d={pathData(outline)} />
      {#each outline.flatMap((c) => c.vertices) as v, i (i)}
        <circle class="point" cx={v.p[0]} cy={v.p[1]} r={reach() / 2} />
      {/each}
    {/if}
  </svg>
</div>

<style>
  .draw {
    position: absolute;
    inset: 0;
    z-index: 3;
    cursor: crosshair;
    touch-action: none;
  }

  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .ghost {
    fill: color-mix(in srgb, var(--ui-accent) 12%, transparent);
    stroke: var(--ui-accent);
    stroke-width: 1.5px;
    vector-effect: non-scaling-stroke;
  }

  .point {
    fill: var(--ui-bg);
    stroke: var(--ui-accent);
    stroke-width: 1.5px;
    vector-effect: non-scaling-stroke;
  }
</style>
