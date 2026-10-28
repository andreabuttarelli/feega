<script lang="ts">
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import { DropOutcome, GuideAxis, addGuide, dropOutcome, moveGuide, removeGuide, rulerTicks, type UserGuide } from '$lib/canvas/user-guides';

  type Size = { width: number; height: number };
  type Drag = { axis: GuideAxis; at: number; from: UserGuide | null };

  const RULER_PX = 16;
  const GRAB_PX = 10;
  const LABEL_PX = 36;
  const HANDLE_PX = 8;

  let { doc, size, onchange }: { doc: MotionDoc; size: Size; onchange: (next: MotionDoc, summary: string) => void } = $props();

  let stage: HTMLElement | undefined = $state();
  let drag = $state<Drag | null>(null);

  const scale = $derived(size.width / doc.width);
  const guides = $derived(doc.userGuides ?? []);
  const across = $derived(rulerTicks(doc.width, scale, LABEL_PX));
  const down = $derived(rulerTicks(doc.height, scale, LABEL_PX));
  const shown = $derived(drag ? [...guides.filter((g) => !drag?.from || g.axis !== drag.from.axis || g.at !== drag.from.at), { axis: drag.axis, at: drag.at }] : guides);

  const AXIS_POINT: Record<GuideAxis, (e: PointerEvent, rect: DOMRect) => number> = {
    [GuideAxis.Vertical]: (e, rect) => e.clientX - rect.left,
    [GuideAxis.Horizontal]: (e, rect) => e.clientY - rect.top
  };

  function grab(e: PointerEvent, axis: GuideAxis, from: UserGuide | null) {
    e.preventDefault();
    e.stopPropagation();
    drag = { axis, at: from?.at ?? -1, from };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', drop, { once: true });
  }

  function move(e: PointerEvent) {
    if (!drag || !stage) {
      return;
    }
    drag = { ...drag, at: Math.round(AXIS_POINT[drag.axis](e, stage.getBoundingClientRect()) / scale) };
  }

  function drop() {
    window.removeEventListener('pointermove', move);
    const done = drag;
    drag = null;
    if (!done) {
      return;
    }

    const landed = { axis: done.axis, at: done.at };
    if (dropOutcome(doc, landed) === DropOutcome.Delete) {
      const gone = done.from ? removeGuide(doc, done.from) : null;
      if (gone?.ok) {
        onchange(gone.doc, 'Removed a guide');
      }
      return;
    }

    const next = done.from ? moveGuide(doc, done.from, landed.at) : addGuide(doc, landed);
    if (next.ok) {
      onchange(next.doc, done.from ? 'Moved a guide' : 'Added a guide');
    }
  }
</script>

<div class="rulers" bind:this={stage} data-testid="rulers" style={`--ruler:${RULER_PX}px;--grab:${GRAB_PX}px;--handle:${HANDLE_PX}px`}>
  <div class="ruler top" role="presentation" data-testid="ruler-top" onpointerdown={(e) => grab(e, GuideAxis.Horizontal, null)}>
    {#each across as t (t.at)}<span class="tick" style={`left:${t.at * scale}px`}>{t.label}</span>{/each}
  </div>
  <div class="ruler left" role="presentation" data-testid="ruler-left" onpointerdown={(e) => grab(e, GuideAxis.Vertical, null)}>
    {#each down as t (t.at)}<span class="tick" style={`top:${t.at * scale - RULER_PX}px`}><i>{t.label}</i></span>{/each}
  </div>
  {#each shown as g (g.axis + ':' + g.at)}
    {#if g.axis === GuideAxis.Vertical}
      <div class="guide vertical" data-testid="user-guide" data-axis={g.axis} data-at={g.at} style={`left:${g.at * scale}px`} role="presentation" onpointerdown={(e) => grab(e, g.axis, g)}></div>
    {:else}
      <div class="guide horizontal" data-testid="user-guide" data-axis={g.axis} data-at={g.at} style={`top:${g.at * scale}px`} role="presentation" onpointerdown={(e) => grab(e, g.axis, g)}></div>
    {/if}
  {/each}
  {#if drag && drag.at >= 0}<span class="readout" data-testid="guide-readout" style={drag.axis === GuideAxis.Vertical ? `left:${drag.at * scale}px;top:0` : `top:${drag.at * scale}px;left:0`}>{drag.at}</span>{/if}
</div>

<style>
  .rulers {
    position: absolute;
    inset: 0;
    pointer-events: none;
    --guide: #0d99ff;
  }

  .ruler {
    position: absolute;
    pointer-events: auto;
    background: color-mix(in srgb, var(--ui-bg) 85%, transparent);
    color: var(--ui-fg-muted, #888);
    border-radius: var(--ui-radius-sm, 4px);
    font-size: 9px;
    line-height: var(--ruler);
    overflow: hidden;
    user-select: none;
  }

  .top {
    left: 0;
    right: var(--handle);
    top: 0;
    height: var(--ruler);
    cursor: ns-resize;
  }

  .left {
    top: var(--ruler);
    bottom: var(--handle);
    left: 0;
    width: var(--ruler);
    cursor: ew-resize;
  }

  .tick {
    position: absolute;
    border-left: 1px solid currentColor;
    padding-left: 6px;
    height: 100%;
    white-space: nowrap;
  }

  .left .tick {
    border-left: 0;
    border-top: 1px solid currentColor;
    padding: 0;
    height: auto;
    width: 100%;
  }

  .left i {
    display: block;
    font-style: normal;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    line-height: var(--ruler);
  }

  .guide {
    position: absolute;
    pointer-events: auto;
    background: transparent;
  }

  .guide::after {
    content: '';
    position: absolute;
    background: var(--guide);
  }

  .vertical {
    top: 0;
    bottom: 0;
    width: var(--grab);
    margin-left: calc(var(--grab) / -2);
    cursor: ew-resize;
  }

  .vertical::after {
    left: 50%;
    top: 0;
    bottom: 0;
    width: 1px;
  }

  .horizontal {
    left: 0;
    right: 0;
    height: var(--grab);
    margin-top: calc(var(--grab) / -2);
    cursor: ns-resize;
  }

  .horizontal::after {
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
  }

  .readout {
    position: absolute;
    padding: 0 4px;
    border-radius: var(--ui-radius-xs, 2px);
    background: var(--guide);
    color: #fff;
    font-size: 10px;
    line-height: 14px;
  }
</style>
