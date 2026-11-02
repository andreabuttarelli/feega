<script lang="ts">
  import DrawOverlay from '$lib/components/motion/DrawOverlay.svelte';
  import ShapeBuilderOverlay from '$lib/components/motion/ShapeBuilderOverlay.svelte';
  import MaskOverlay from '$lib/components/motion/MaskOverlay.svelte';
  import PenOverlay from '$lib/components/motion/PenOverlay.svelte';
  import VectorOverlay from '$lib/components/motion/VectorOverlay.svelte';
  import AutoLayoutOverlay from '$lib/components/motion/AutoLayoutOverlay.svelte';
  import TextPathOverlay from '$lib/components/motion/TextPathOverlay.svelte';
  import Rulers from '$lib/components/canvas/Rulers.svelte';
  import LayoutGuidesOverlay from '$lib/components/motion/LayoutGuidesOverlay.svelte';
  import CornerOverlay from '$lib/components/motion/CornerOverlay.svelte';
  import MotionPathOverlay from '$lib/components/motion/MotionPathOverlay.svelte';
  import OnionOverlay from '$lib/components/motion/OnionOverlay.svelte';
  import { onionSetting } from '$lib/canvas/onion-skin.svelte';
  import OutlineOverlay from '$lib/components/motion/OutlineOverlay.svelte';
  import PixelGridOverlay from '$lib/components/motion/PixelGridOverlay.svelte';
  import { findClip, type MotionDoc } from '@feega/motion-core/motion/doc';
  import { DrawTool } from '$lib/motion/draw-tool';
  import { EditMode } from '$lib/motion/edit-mode';
  import { drawStart } from '$lib/motion/draw-create';
  import { editsPoints, enterPointEdit, landsOn, pointDraft } from '$lib/motion/shape/vector-edit';
  import type { Pt } from '@feega/motion-core/motion/shape/geometry';
  import { isTyping } from '$lib/motion/shortcuts';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import { containFit } from '$lib/canvas/frame-hover';
  import { withAutoLayout } from '@feega/motion-core/motion/layout/resolve';
  import type { Boxes } from '$lib/motion/scene-select';
  import { GridToggle } from '$lib/motion/pixel-grid';
  import { FRAME_VIEW_DEFAULT, FrameView, shows, type FrameViews } from '$lib/canvas/frame-view';
  import { activeAt, shownOverlays, FrameOverlay } from '$lib/canvas/frame-tools';

  type Size = { width: number; height: number };

  let {
    doc,
    frame,
    mode = EditMode.Design,
    size,
    picks,
    tool,
    views = FRAME_VIEW_DEFAULT,
    boxes = {},
    apply,
    ondrawn,
    onleave
  }: {
    doc: MotionDoc;
    frame: number;
    mode?: EditMode;
    size: Size;
    picks: string[];
    tool: DrawTool;
    views?: FrameViews;
    boxes?: Boxes;
    apply: (result: OpResult, summary: string) => void;
    ondrawn: (id: string) => void;
    onleave: () => void;
  } = $props();

  let pointEdit = $state<string | null>(null);
  let stage = $state<HTMLDivElement | null>(null);

  const only = $derived(picks.length === 1 ? (findClip(doc, picks[0])?.clip ?? null) : null);
  const fit = $derived(containFit(size, { width: doc.width, height: doc.height }));
  const drafted = $derived(pointDraft(doc, pointEdit));
  const pointClip = $derived(pointEdit && only?.id === pointEdit ? (findClip(drafted, pointEdit)?.clip ?? only) : only);
  const shown = $derived(shownOverlays({ doc, clip: pointClip, picks: picks.length, tool, pointEdit, active: only ? activeAt(only, frame) : false, views, mode, onion: onionSetting.skin }));
  const laidOut = $derived(only && shown.has(FrameOverlay.Corners) ? (findClip(withAutoLayout(doc), only.id)?.clip ?? only) : null);

  $effect(() => {
    if (pointEdit && only?.id !== pointEdit) {
      pointEdit = null;
    }
  });

  const edit = (next: MotionDoc, summary: string) => apply({ ok: true, doc: next }, summary);

  function created(id: string) {
    const made = findClip(doc, id)?.clip;
    pointEdit = made?.props.shape === 'path' ? id : null;
    ondrawn(id);
  }

  function editPoints(e: Event, clip: NonNullable<typeof only>) {
    if (!enterPointEdit(doc, clip).ok) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    pointEdit = clip.id;
  }

  const editable = (e: Event) => (tool === DrawTool.Select && !pointEdit && only && editsPoints(doc, only) && !isTyping(e.target as HTMLElement | null) ? only : null);

  function enter(e: KeyboardEvent) {
    const clip = e.key === 'Enter' && !e.shiftKey ? editable(e) : null;
    if (clip) {
      editPoints(e, clip);
    }
  }

  function double(e: MouseEvent) {
    const clip = editable(e);
    const rect = stage?.getBoundingClientRect();
    if (!clip || !rect || rect.width <= 0) {
      return;
    }
    const at: Pt = [((e.clientX - rect.left) / rect.width) * doc.width, ((e.clientY - rect.top) / rect.height) * doc.height];
    if (landsOn(doc, clip.id, frame, at)) {
      editPoints(e, clip);
    }
  }
</script>

<svelte:window onkeydowncapture={enter} ondblclickcapture={double} />

<div class="stage" bind:this={stage} data-testid="frame-tools" style={`left:${fit.left}px;top:${fit.top}px;width:${fit.width}px;height:${fit.height}px`}>
  {#if shown.has(FrameOverlay.Outlines)}<div class="beneath"><OutlineOverlay {doc} {frame} {boxes} /></div>{/if}
  <PixelGridOverlay width={doc.width} height={doc.height} toggle={shows(views, FrameView.PixelGrid) ? GridToggle.On : GridToggle.Off} />
  {#if shown.has(FrameOverlay.Guides)}<LayoutGuidesOverlay {doc} />{/if}
  {#if shown.has(FrameOverlay.Rulers)}<Rulers {doc} size={{ width: fit.width, height: fit.height }} onchange={edit} />{/if}
  {#if only && shown.has(FrameOverlay.Mask)}<MaskOverlay {doc} clip={only} {frame} onchange={edit} />{/if}
  {#if pointClip && shown.has(FrameOverlay.Pen)}<PenOverlay doc={drafted} clip={pointClip} {frame} onchange={edit} onexit={() => (pointEdit = null)} />{/if}
  {#if pointClip && shown.has(FrameOverlay.Vector)}<VectorOverlay doc={drafted} clip={pointClip} {frame} onchange={edit} onexit={() => (pointEdit = null)} />{/if}
  {#if only?.autoLayout && shown.has(FrameOverlay.AutoLayout)}<AutoLayoutOverlay {doc} clip={{ ...only, autoLayout: only.autoLayout }} onchange={edit} />{/if}
  {#if only && shown.has(FrameOverlay.TextPath)}<TextPathOverlay {doc} clip={only} {frame} />{/if}
  {#if laidOut}<CornerOverlay {doc} {frame} clip={laidOut} onchange={edit} />{/if}
  {#if only && shown.has(FrameOverlay.Onion)}<OnionOverlay {doc} clip={only} {frame} {boxes} />{/if}
  {#if only && shown.has(FrameOverlay.MotionPath)}<MotionPathOverlay {doc} clip={only} {frame} onchange={edit} />{/if}
  {#if shown.has(FrameOverlay.ShapeBuilder)}<ShapeBuilderOverlay {doc} {frame} {picks} onchange={apply} onexit={onleave} />{/if}
  {#if shown.has(FrameOverlay.Draw)}
    <div class="draw">
      <DrawOverlay {doc} frame={drawStart(mode, frame)} {tool} onchange={apply} oncreated={created} />
    </div>
  {/if}
</div>

<style>
  .beneath {
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }

  .stage {
    position: absolute;
    pointer-events: none;
  }

  .draw {
    position: absolute;
    inset: 0;
    pointer-events: auto;
  }
</style>
