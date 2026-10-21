<script lang="ts">
  import DrawOverlay from '$lib/components/motion/DrawOverlay.svelte';
  import MaskOverlay from '$lib/components/motion/MaskOverlay.svelte';
  import PenOverlay from '$lib/components/motion/PenOverlay.svelte';
  import VectorOverlay from '$lib/components/motion/VectorOverlay.svelte';
  import AutoLayoutOverlay from '$lib/components/motion/AutoLayoutOverlay.svelte';
  import TextPathOverlay from '$lib/components/motion/TextPathOverlay.svelte';
  import LayoutGuidesOverlay from '$lib/components/motion/LayoutGuidesOverlay.svelte';
  import AlignBar from '$lib/components/motion/AlignBar.svelte';
  import { findClip, type MotionDoc } from '$lib/motion/doc';
  import { DrawTool } from '$lib/motion/draw-tool';
  import { EditMode } from '$lib/motion/edit-mode';
  import { Axis, Edge, alignSpace, distributeSpace, propBoxes } from '$lib/motion/space';
  import { canEditPoints, enterPointEdit } from '$lib/motion/shape/vector-edit';
  import { isTyping } from '$lib/motion/shortcuts';
  import type { OpResult } from '$lib/motion/timeline';
  import { containFit } from '$lib/canvas/frame-hover';
  import { activeAt, shownOverlays, AlignSide, FrameOverlay } from '$lib/canvas/frame-tools';

  type Size = { width: number; height: number };

  let { doc, frame, size, picks, tool, side, apply, ondrawn }: { doc: MotionDoc; frame: number; size: Size; picks: string[]; tool: DrawTool; side: AlignSide; apply: (result: OpResult, summary: string) => void; ondrawn: (id: string) => void } = $props();

  let pointEdit = $state<string | null>(null);

  const only = $derived(picks.length === 1 ? (findClip(doc, picks[0])?.clip ?? null) : null);
  const fit = $derived(containFit(size, { width: doc.width, height: doc.height }));
  const shown = $derived(shownOverlays({ doc, clip: only, picks: picks.length, tool, pointEdit, active: only ? activeAt(only, frame) : false }));

  $effect(() => {
    if (pointEdit && only?.id !== pointEdit) {
      pointEdit = null;
    }
  });

  const edit = (next: MotionDoc, summary: string) => apply({ ok: true, doc: next }, summary);
  const alignTo = (edge: Edge) => apply(alignSpace(doc, picks, frame, propBoxes(doc), edge, EditMode.Design), `Aligned ${edge}`);
  const distribute = (axis: Axis) => apply(distributeSpace(doc, picks, frame, propBoxes(doc), axis, EditMode.Design), `Distributed along ${axis}`);

  function created(id: string) {
    const made = findClip(doc, id)?.clip;
    pointEdit = made?.props.shape === 'path' ? id : null;
    ondrawn(id);
  }

  function enter(e: KeyboardEvent) {
    if (e.key !== 'Enter' || tool !== DrawTool.Select || pointEdit || !only || !canEditPoints(only) || isTyping(e.target as HTMLElement | null)) {
      return;
    }
    const entered = enterPointEdit(doc, only);
    if (!entered.ok) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (entered.doc !== doc) {
      edit(entered.doc, 'Edited the shape as a path');
    }
    pointEdit = only.id;
  }
</script>

<svelte:window onkeydowncapture={enter} />

<div class="stage" data-testid="frame-tools" style={`left:${fit.left}px;top:${fit.top}px;width:${fit.width}px;height:${fit.height}px`}>
  {#if shown.has(FrameOverlay.Guides)}<LayoutGuidesOverlay {doc} />{/if}
  {#if only && shown.has(FrameOverlay.Mask)}<MaskOverlay {doc} clip={only} {frame} onchange={edit} />{/if}
  {#if only && shown.has(FrameOverlay.Pen)}<PenOverlay {doc} clip={only} {frame} onchange={edit} onexit={() => (pointEdit = null)} />{/if}
  {#if only && shown.has(FrameOverlay.Vector)}<VectorOverlay {doc} clip={only} {frame} onchange={edit} onexit={() => (pointEdit = null)} />{/if}
  {#if only?.autoLayout && shown.has(FrameOverlay.AutoLayout)}<AutoLayoutOverlay {doc} clip={{ ...only, autoLayout: only.autoLayout }} onchange={edit} />{/if}
  {#if only && shown.has(FrameOverlay.TextPath)}<TextPathOverlay {doc} clip={only} {frame} />{/if}
  {#if shown.has(FrameOverlay.Draw)}
    <div class="draw">
      <DrawOverlay {doc} {frame} {tool} onchange={apply} oncreated={created} />
    </div>
  {/if}
</div>

{#if shown.has(FrameOverlay.Align)}
  <div class="align" data-side={side} data-testid="frame-align" role="presentation" onpointerdown={(e) => e.stopPropagation()}>
    <AlignBar count={picks.length} onalign={alignTo} ondistribute={distribute} />
  </div>
{/if}

<style>
  .stage {
    position: absolute;
    pointer-events: none;
  }

  .draw {
    position: absolute;
    inset: 0;
    pointer-events: auto;
  }

  .align {
    position: absolute;
    left: 0;
    top: 100%;
    margin-top: 8px;
    pointer-events: auto;
    background: var(--ui-bg);
  }

  .align[data-side='right'] {
    left: 100%;
    top: 0;
    margin-top: 0;
    margin-left: 8px;
  }

  .align[data-side='above'] {
    top: auto;
    bottom: 100%;
    margin-top: 0;
    margin-bottom: 8px;
  }
</style>
