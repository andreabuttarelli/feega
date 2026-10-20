<script lang="ts">
  import type { Component } from 'svelte';
  import AlignStartVertical from '@lucide/svelte/icons/align-start-vertical';
  import AlignCenterVertical from '@lucide/svelte/icons/align-center-vertical';
  import AlignEndVertical from '@lucide/svelte/icons/align-end-vertical';
  import AlignStartHorizontal from '@lucide/svelte/icons/align-start-horizontal';
  import AlignCenterHorizontal from '@lucide/svelte/icons/align-center-horizontal';
  import AlignEndHorizontal from '@lucide/svelte/icons/align-end-horizontal';
  import MoveHorizontal from '@lucide/svelte/icons/move-horizontal';
  import MoveVertical from '@lucide/svelte/icons/move-vertical';
  import Move from '@lucide/svelte/icons/move';
  import Triangle from '@lucide/svelte/icons/triangle-right';
  import RotateCw from '@lucide/svelte/icons/rotate-cw-square';
  import FlipHorizontal from '@lucide/svelte/icons/flip-horizontal-2';
  import FlipVertical from '@lucide/svelte/icons/flip-vertical-2';
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { setProps, setTransform, type OpResult } from '$lib/motion/timeline';
  import { HORIZONTALS, Horizontal, VERTICALS, Vertical } from '$lib/motion/constraints/model';
  import { setConstraints } from '$lib/motion/constraints/constraints';
  import { Side, Toggle, pinnedHorizontally, pinnedVertically, toggleHorizontal, toggleVertical } from '$lib/motion/constraints/sides';
  import { Edge } from '$lib/motion/space';
  import { Flip, QUARTER_TURN, flipClips, turnClips } from '$lib/motion/layer-props';
  import { pivotBox } from '$lib/motion/parent';
  import { TRANSFORM } from '$lib/motion/keyframes';

  let { doc, clip, onchange, onalign }: { doc: MotionDoc; clip: MotionClip; onchange: (result: OpResult, summary: string) => void; onalign: (edge: Edge) => void } = $props();

  const ICON = 15;
  const PIVOT_STOPS = [0, 0.5, 1] as const;

  const HORIZONTAL_ALIGNS: { edge: Edge; label: string; icon: Component }[] = [
    { edge: Edge.Left, label: 'Align left', icon: AlignStartVertical },
    { edge: Edge.Center, label: 'Align centre horizontally', icon: AlignCenterVertical },
    { edge: Edge.Right, label: 'Align right', icon: AlignEndVertical }
  ];

  const VERTICAL_ALIGNS: { edge: Edge; label: string; icon: Component }[] = [
    { edge: Edge.Top, label: 'Align top', icon: AlignStartHorizontal },
    { edge: Edge.Middle, label: 'Align middle vertically', icon: AlignCenterHorizontal },
    { edge: Edge.Bottom, label: 'Align bottom', icon: AlignEndHorizontal }
  ];

  const LABEL: Record<Horizontal | Vertical, string> = {
    [Horizontal.Left]: 'Left',
    [Horizontal.Right]: 'Right',
    [Horizontal.LeftRight]: 'Left & right',
    [Horizontal.Center]: 'Center',
    [Horizontal.Scale]: 'Scale',
    [Vertical.Top]: 'Top',
    [Vertical.Bottom]: 'Bottom',
    [Vertical.TopBottom]: 'Top & bottom'
  };

  let showConstraints = $state(true);

  const box = $derived(pivotBox(clip.props, doc));
  const placed = $derived(typeof clip.props.x === 'number' && typeof clip.props.y === 'number');
  const pinnable = $derived(placed && !clip.parent);
  const horizontal = $derived(clip.constraints?.horizontal ?? Horizontal.Scale);
  const vertical = $derived(clip.constraints?.vertical ?? Vertical.Scale);
  const across = $derived(pinnedHorizontally(horizontal));
  const down = $derived(pinnedVertically(vertical));
  const pivotX = $derived(clip.transform.anchorX ?? TRANSFORM.anchorX.fallback);
  const pivotY = $derived(clip.transform.anchorY ?? TRANSFORM.anchorY.fallback);
  const rotation = $derived(clip.transform.rotateZ ?? 0);

  const numberOf = (e: Event) => Number((e.currentTarget as HTMLInputElement).value);
  const moveX = (e: Event) => onchange(setProps(doc, clip.id, { x: (numberOf(e) + box.width / 2) / doc.width }), 'Moved horizontally');
  const moveY = (e: Event) => onchange(setProps(doc, clip.id, { y: (numberOf(e) + box.height / 2) / doc.height }), 'Moved vertically');
  const pinH = (h: Horizontal) => onchange(setConstraints(doc, [clip.id], { horizontal: h }), 'Changed the horizontal constraint');
  const pinV = (v: Vertical) => onchange(setConstraints(doc, [clip.id], { vertical: v }), 'Changed the vertical constraint');
  const tickH = (side: Side, e: MouseEvent) => pinH(toggleHorizontal(horizontal, side, e.shiftKey ? Toggle.Both : Toggle.One));
  const tickV = (side: Side, e: MouseEvent) => pinV(toggleVertical(vertical, side, e.shiftKey ? Toggle.Both : Toggle.One));
  const centre = () => onchange(setConstraints(doc, [clip.id], { horizontal: Horizontal.Center, vertical: Vertical.Center }), 'Centred the constraints');
</script>

<div class="position" data-testid="position-section">
  <div class="row">
    <div class="segments" role="group" aria-label="Align horizontally in the frame">
      {#each HORIZONTAL_ALIGNS as a (a.edge)}
        <button type="button" aria-label={a.label} title={a.label} data-align={a.edge} onclick={() => onalign(a.edge)}><a.icon size={ICON} /></button>
      {/each}
    </div>
    <div class="segments" role="group" aria-label="Align vertically in the frame">
      {#each VERTICAL_ALIGNS as a (a.edge)}
        <button type="button" aria-label={a.label} title={a.label} data-align={a.edge} onclick={() => onalign(a.edge)}><a.icon size={ICON} /></button>
      {/each}
    </div>
  </div>

  {#if placed}
    <div class="row xy">
      <label class="field"><span>X</span><input type="number" step="1" value={Math.round(box.left)} data-testid="position-x" onchange={moveX} /></label>
      <label class="field"><span>Y</span><input type="number" step="1" value={Math.round(box.top)} data-testid="position-y" onchange={moveY} /></label>
      {#if pinnable}
        <button type="button" class="toggle" class:on={showConstraints} aria-pressed={showConstraints} aria-label="Constraints" title="Constraints" data-testid="constraints-toggle" onclick={() => (showConstraints = !showConstraints)}><Move size={ICON} /></button>
      {/if}
    </div>
  {/if}

  {#if pinnable && showConstraints}
    <div class="constraints" data-testid="constraints-section">
      <div class="selects">
        <label class="select">
          <MoveHorizontal size={ICON} />
          <select aria-label="Horizontal constraint" value={horizontal} data-testid="constraint-horizontal" onchange={(e) => pinH(e.currentTarget.value as Horizontal)}>
            {#each HORIZONTALS as h (h)}<option value={h}>{LABEL[h]}</option>{/each}
          </select>
        </label>
        <label class="select">
          <MoveVertical size={ICON} />
          <select aria-label="Vertical constraint" value={vertical} data-testid="constraint-vertical" onchange={(e) => pinV(e.currentTarget.value as Vertical)}>
            {#each VERTICALS as v (v)}<option value={v}>{LABEL[v]}</option>{/each}
          </select>
        </label>
      </div>
      <div class="widget" role="group" aria-label="Constraints" data-testid="constraint-widget">
        <button type="button" class="tick left" class:on={across.start} aria-label="Pin left" aria-pressed={across.start} onclick={(e) => tickH(Side.Start, e)}></button>
        <button type="button" class="tick right" class:on={across.end} aria-label="Pin right" aria-pressed={across.end} onclick={(e) => tickH(Side.End, e)}></button>
        <button type="button" class="tick top" class:on={down.start} aria-label="Pin top" aria-pressed={down.start} onclick={(e) => tickV(Side.Start, e)}></button>
        <button type="button" class="tick bottom" class:on={down.end} aria-label="Pin bottom" aria-pressed={down.end} onclick={(e) => tickV(Side.End, e)}></button>
        <button type="button" class="inner" class:on={horizontal === Horizontal.Center && vertical === Vertical.Center} aria-label="Centre" title="Centre" onclick={centre}></button>
      </div>
    </div>
  {/if}

  <div class="row turn">
    <div class="rotation">
      <label class="field"><Triangle size={ICON} /><input type="number" step="1" value={rotation} aria-label="Rotation" data-testid="rotation-field" onchange={(e) => onchange(setTransform(doc, clip.id, { rotateZ: numberOf(e) }), 'Rotated the layer')} /><span>°</span></label>
      <div class="pivot" role="group" aria-label="Pivot">
        {#each PIVOT_STOPS as py (py)}
          {#each PIVOT_STOPS as px (px)}
            <button type="button" class:on={pivotX === px && pivotY === py} aria-label={`Pivot ${px} ${py}`} title="Pivot" onclick={() => onchange(setTransform(doc, clip.id, { anchorX: px, anchorY: py }), 'Moved the pivot')}></button>
          {/each}
        {/each}
      </div>
    </div>
    <div class="segments" role="group" aria-label="Rotate and flip">
      <button type="button" aria-label="Rotate 90 degrees" title="Rotate 90°" data-testid="rotate-90" onclick={() => onchange(turnClips(doc, [clip.id], QUARTER_TURN), 'Rotated 90 degrees')}><RotateCw size={ICON} /></button>
      <button type="button" aria-label="Flip horizontal" title="Flip horizontal" data-testid="flip-horizontal" onclick={() => onchange(flipClips(doc, [clip.id], Flip.Horizontal), 'Flipped horizontally')}><FlipHorizontal size={ICON} /></button>
      <button type="button" aria-label="Flip vertical" title="Flip vertical" data-testid="flip-vertical" onclick={() => onchange(flipClips(doc, [clip.id], Flip.Vertical), 'Flipped vertically')}><FlipVertical size={ICON} /></button>
    </div>
  </div>
</div>

<style>
  .position {
    display: grid;
    gap: 6px;
    padding: var(--ui-space-2) 0;
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-2);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .row > * {
    flex: 1 1 0;
    min-width: 0;
  }

  .row .toggle {
    flex: 0 0 28px;
  }

  .segments {
    display: flex;
    background: var(--ui-input);
    border-radius: var(--ui-radius-sm);
  }

  .segments button,
  .toggle {
    display: grid;
    place-items: center;
    flex: 1;
    height: 28px;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-ink);
    cursor: pointer;
  }

  .toggle {
    width: 28px;
    background: var(--ui-input);
  }

  .segments button:hover,
  .toggle:hover {
    background: var(--ui-hover);
  }

  .toggle.on {
    background: var(--ui-accent);
    color: var(--ui-accent-ink, var(--ui-ink));
  }

  .field,
  .select {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 8px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
  }

  .field input,
  .select select {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ui-ink);
    font: inherit;
  }

  .constraints {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 6px;
  }

  .selects {
    display: grid;
    gap: 6px;
    align-content: start;
  }

  .widget {
    position: relative;
    min-height: 62px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
  }

  .inner {
    position: absolute;
    inset: 16px 28px;
    padding: 0;
    border: 1px solid var(--ui-divider-strong);
    border-radius: var(--ui-radius-xs);
    background: none;
    cursor: pointer;
  }

  .inner.on {
    border-color: var(--ui-accent);
  }

  .tick {
    position: absolute;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-xs);
    background: var(--ui-divider-strong);
    cursor: pointer;
  }

  .tick.on {
    background: var(--ui-accent);
  }

  .tick.left,
  .tick.right {
    top: 50%;
    width: 14px;
    height: 3px;
    transform: translateY(-50%);
  }

  .tick.left {
    left: 6px;
  }

  .tick.right {
    right: 6px;
  }

  .tick.top,
  .tick.bottom {
    left: 50%;
    width: 3px;
    height: 12px;
    transform: translateX(-50%);
  }

  .tick.top {
    top: 3px;
  }

  .tick.bottom {
    bottom: 3px;
  }

  .rotation {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .rotation .field {
    flex: 1;
  }

  .pivot {
    display: grid;
    grid-template-columns: repeat(3, 6px);
    gap: 3px;
    padding: 4px;
    background: var(--ui-input);
    border-radius: var(--ui-radius-sm);
  }

  .pivot button {
    width: 6px;
    height: 6px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--ui-divider-strong);
  }

  .pivot button.on {
    background: var(--ui-accent);
  }
</style>
