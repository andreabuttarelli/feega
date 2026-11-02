<script lang="ts">
  import type { Component } from 'svelte';
  import { PositionPart } from '$lib/motion/position-part';
  import AlignStartVertical from '@lucide/svelte/icons/align-start-vertical';
  import AlignCenterVertical from '@lucide/svelte/icons/align-center-vertical';
  import AlignEndVertical from '@lucide/svelte/icons/align-end-vertical';
  import AlignStartHorizontal from '@lucide/svelte/icons/align-start-horizontal';
  import AlignCenterHorizontal from '@lucide/svelte/icons/align-center-horizontal';
  import AlignEndHorizontal from '@lucide/svelte/icons/align-end-horizontal';
  import MoveHorizontal from '@lucide/svelte/icons/move-horizontal';
  import MoveVertical from '@lucide/svelte/icons/move-vertical';
  import Triangle from '@lucide/svelte/icons/triangle-right';
  import RotateCw from '@lucide/svelte/icons/rotate-cw-square';
  import FlipHorizontal from '@lucide/svelte/icons/flip-horizontal-2';
  import FlipVertical from '@lucide/svelte/icons/flip-vertical-2';
  import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
  import { setTransform, type OpResult } from '@feega/motion-core/motion/timeline';
  import { HORIZONTALS, Horizontal, VERTICALS, Vertical } from '@feega/motion-core/motion/constraints/model';
  import { setConstraints } from '$lib/motion/constraints/constraints';
  import { Side, Toggle, pinnedHorizontally, pinnedVertically, toggleHorizontal, toggleVertical } from '$lib/motion/constraints/sides';
  import { Edge } from '$lib/motion/space';
  import { Flip, QUARTER_TURN, flipClips, turnClips } from '$lib/motion/layer-props';
  import { pivotBox } from '@feega/motion-core/motion/parent';
  import { TRANSFORM } from '@feega/motion-core/motion/keyframes';
  import { Placement } from '@feega/motion-core/motion/layout/stack';
  import { positionShown } from '$lib/motion/properties-view';
  import { placeLayer } from '$lib/motion/light-group';
  import type { ElementHost } from '$lib/motion/element-host';
  import type { Frame } from '$lib/motion/units';
  import { liveEdits } from '$lib/motion/live-edit';
  import { FieldKind } from '$lib/motion/number-field';
  import NumberField from './NumberField.svelte';

  let { doc, clip, part, placement = Placement.Free, within = null, host = null, space = doc, onchange, onalign }: { doc: MotionDoc; clip: MotionClip; part: PositionPart; placement?: Placement; within?: MotionClip | null; host?: ElementHost | null; space?: Frame; onchange: (result: OpResult, summary: string) => void; onalign: (edge: Edge) => void } = $props();

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

  const box = $derived(pivotBox(clip.props, doc));
  const placed = $derived(typeof clip.props.x === 'number' && typeof clip.props.y === 'number' && positionShown(placement));
  const origin = $derived(within ? pivotBox(within.props, doc) : { left: 0, top: 0 });
  const pinnable = $derived(placed && !clip.parent);
  const horizontal = $derived(clip.constraints?.horizontal ?? Horizontal.Scale);
  const vertical = $derived(clip.constraints?.vertical ?? Vertical.Scale);
  const across = $derived(pinnedHorizontally(horizontal));
  const down = $derived(pinnedVertically(vertical));
  const pivotX = $derived(clip.transform.anchorX ?? TRANSFORM.anchorX.fallback);
  const pivotY = $derived(clip.transform.anchorY ?? TRANSFORM.anchorY.fallback);
  const PLACE_RANGE = { min: -1_000_000, max: 1_000_000, step: 1 };
  const TURN_RANGE = { min: -360, max: 360, step: 1 };

  const own = $derived(clip.transform.rotateZ ?? 0);
  const rotation = $derived((host?.box.rotation ?? 0) + own);
  const scale = $derived({ x: space.width / doc.width, y: space.height / doc.height });
  const seat = $derived(host ? { x: host.box.x, y: host.box.y } : { x: 0, y: 0 });
  const shownX = $derived(Math.round(seat.x + (box.left - origin.left) * scale.x));
  const shownY = $derived(Math.round(seat.y + (box.top - origin.top) * scale.y));
  const hostEdit = liveEdits<() => void>({ show: () => {}, record: (run) => run() });
  const gesture = $derived(host ? hostEdit : null);

  const rotate = (degrees: number) => (host ? hostEdit.edit(() => host.turn(degrees - own), 'Rotated the element') : onchange(setTransform(doc, clip.id, { rotateZ: degrees }), 'Rotated the layer'));
  const moveX = (x: number) => (host ? hostEdit.edit(() => host.move(host.box.x + x - shownX, host.box.y), 'Moved horizontally') : onchange(placeLayer(doc, clip.id, { x: ((x - seat.x) / scale.x + origin.left + box.width / 2) / doc.width }), 'Moved horizontally'));
  const moveY = (y: number) => (host ? hostEdit.edit(() => host.move(host.box.x, host.box.y + y - shownY), 'Moved vertically') : onchange(placeLayer(doc, clip.id, { y: ((y - seat.y) / scale.y + origin.top + box.height / 2) / doc.height }), 'Moved vertically'));
  const pinH = (h: Horizontal) => onchange(setConstraints(doc, [clip.id], { horizontal: h }), 'Changed the horizontal constraint');
  const pinV = (v: Vertical) => onchange(setConstraints(doc, [clip.id], { vertical: v }), 'Changed the vertical constraint');
  const tickH = (side: Side, e: MouseEvent) => pinH(toggleHorizontal(horizontal, side, e.shiftKey ? Toggle.Both : Toggle.One));
  const tickV = (side: Side, e: MouseEvent) => pinV(toggleVertical(vertical, side, e.shiftKey ? Toggle.Both : Toggle.One));
  const centre = () => onchange(setConstraints(doc, [clip.id], { horizontal: Horizontal.Center, vertical: Vertical.Center }), 'Centred the constraints');
</script>

<div class="position" data-testid="position-section" data-part={part}>
  {#if part === PositionPart.Align}
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
  {/if}

  {#if part === PositionPart.Position && placed}
    <div class="row xy">
      <div class="slot"><NumberField label="X" name="X" testid="position-x" kind={FieldKind.Glyph} value={shownX} range={PLACE_RANGE} unit="px" {gesture} onchange={moveX} /></div>
      <div class="slot"><NumberField label="Y" name="Y" testid="position-y" kind={FieldKind.Glyph} value={shownY} range={PLACE_RANGE} unit="px" {gesture} onchange={moveY} /></div>
    </div>
  {/if}

  {#if part === PositionPart.Constraints && pinnable}
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

  {#if part === PositionPart.Rotation}
    <div class="row turn">
      <div class="rotation">
        <div class="slot"><NumberField label="" icon={Triangle} name="Rotation" testid="rotation-field" kind={FieldKind.Glyph} value={rotation} range={TURN_RANGE} unit="°" {gesture} onchange={rotate} /></div>
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
  {/if}
</div>

<style>
  .position {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--ui-space-2);
    min-width: 0;
    font-size: var(--ui-text-xs);
    color: var(--ui-ink-2);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
  }

  .row > * {
    flex: 1 1 0;
    min-width: 0;
  }

  .row > :global(.ib) {
    flex: 0 0 var(--ui-row);
    height: var(--ui-row);
  }

  .segments {
    display: flex;
    gap: 1px;
    border-radius: var(--ui-radius-md);
    overflow: hidden;
  }

  .segments button {
    display: grid;
    place-items: center;
    flex: 1;
    height: var(--ui-row);
    padding: 0;
    border: 0;
    border-radius: 0;
    background: var(--ui-input);
    color: var(--ui-ink);
    cursor: pointer;
    transition: background-color var(--ui-dur-fast, 120ms) ease;
  }

  .segments button:hover {
    background: var(--ui-input-hover);
  }

  .select {
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--ui-row);
    padding: 0 10px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
    color: var(--ui-text-2);
    font-size: var(--ui-text-sm);
    transition: background-color var(--ui-dur-fast, 120ms) ease;
  }

  .select:hover {
    background: var(--ui-input-hover);
  }

  .select:focus-within {
    box-shadow: inset 0 0 0 1px var(--ui-accent);
  }

  .select select {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ui-ink);
    font: inherit;
    outline: none;
    appearance: textfield;
  }

  .select select {
    padding-right: 18px;
    appearance: none;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10' fill='none' stroke='%238a8a8a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M2.5 4l2.5 2.5L7.5 4'/%3E%3C/svg%3E") no-repeat right 0 center / 10px 10px;
  }

  .constraints {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--ui-space-2);
  }

  .selects {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--ui-space-2);
    align-content: start;
    min-width: 0;
  }

  .widget {
    position: relative;
    min-height: 72px;
    border-radius: var(--ui-radius-md);
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
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
  }

  .rotation .slot {
    flex: 1;
    min-width: 0;
  }

  .pivot {
    display: grid;
    grid-template-columns: repeat(3, 6px);
    gap: 3px;
    padding: 7px;
    background: var(--ui-input);
    border-radius: var(--ui-radius-md);
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
