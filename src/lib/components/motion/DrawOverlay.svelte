<script lang="ts">
  import { hostFraction, hostWidth } from '$lib/motion/overlay-point';
  import { TextSizing } from '$lib/motion/text-sizing';
  import type { MotionDoc } from '$lib/motion/doc';
  import { DrawTool, clickBox, closesOnFirst, dragRect, type DragPoint, type DrawBox } from '$lib/motion/draw-tool';
  import { drawClip, penClip } from '$lib/motion/draw-create';
  import { mapOutline, pathData, type Outline, type Pt } from '$lib/motion/shape/geometry';
  import { Handle, Mirror, addPoint, dragHandle, toggleClosed, type PointRef } from '$lib/motion/shape/pen';
  import type { OpResult } from '$lib/motion/timeline';

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

  const SUMMARY: Record<DrawTool, string> = {
    [DrawTool.Select]: '',
    [DrawTool.Text]: 'Drew a text',
    [DrawTool.Rectangle]: 'Drew a rectangle',
    [DrawTool.Ellipse]: 'Drew an ellipse',
    [DrawTool.Pen]: 'Drew a path',
    [DrawTool.Frame]: 'Drew a frame'
  };

  let host = $state<HTMLDivElement | null>(null);
  let drag = $state<{ from: DragPoint; to: DragPoint; square: boolean } | null>(null);
  let outline = $state.raw<Outline>([]);
  let grab = $state<PointRef | null>(null);

  let held = $state.raw<DrawBox | null>(null);
  const live = $derived(drag ? dragRect(drag.from, drag.to, drag.square) : held);
  const newId = () => crypto.randomUUID().slice(0, 8);

  function local(e: PointerEvent): DragPoint {
    const at = hostFraction(e, host!);
    return { x: at.x * doc.width, y: at.y * doc.height };
  }

  const reach = () => (host ? (CLOSE_REACH_PX * doc.width) / hostWidth(host) : CLOSE_REACH_PX);
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
    if (!drag) {
      return;
    }
    const dragged = drag ? live : null;
    const box = dragged ?? (tool === DrawTool.Text ? clickBox(drag.from, { width: TEXT_BOX.width * doc.width, height: TEXT_BOX.height * doc.height }) : null);
    drag = null;
    if (!box) {
      return;
    }
    held = box;
    const id = newId();
    create(drawClip(doc, tool, unit(box), frame, id, dragged ? TextSizing.AutoHeight : TextSizing.AutoWidth), id);
  }

  function finish(done: Outline) {
    outline = [];
    grab = null;
    const id = newId();
    create(penClip(doc, mapOutline(done, ([x, y]) => [x / doc.width, y / doc.height]), frame, id), id);
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
