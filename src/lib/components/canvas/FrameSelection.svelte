<script lang="ts">
  import { Grip, handlesOf, type Quad } from '$lib/motion/scene-select';
  import { outwardOf } from '$lib/motion/element-gesture';
  import { SelectionKind } from '$lib/canvas/frame-transform';

  type Rect = { left: number; top: number; width: number; height: number };

  let { clip, rect, kind = SelectionKind.Element, ongrab }: { clip: string; rect: Rect; kind?: SelectionKind; ongrab: (grip: Grip, handle: number, e: PointerEvent) => void } = $props();

  const ROTATE_REACH_PX = 14;
  const TESTID: Record<SelectionKind, string> = { [SelectionKind.Element]: 'frame-selection', [SelectionKind.Member]: 'frame-selection', [SelectionKind.Group]: 'frame-group-selection' };

  const quad = $derived<Quad>([
    [0, 0],
    [rect.width, 0],
    [rect.width, rect.height],
    [0, rect.height]
  ]);
  const handles = $derived(kind === SelectionKind.Member ? [] : handlesOf(quad));
  const corners = $derived(handles.slice(0, 4));
</script>

<div class="selection" class:group={kind === SelectionKind.Group} data-testid={TESTID[kind]} data-clip={clip || undefined} style={`left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`}>
  <div class="body" data-testid="frame-selection-body" onpointerdown={(e) => ongrab(Grip.Move, 0, e)} role="presentation"></div>
  {#each corners as h, i (i)}
    {@const [ux, uy] = outwardOf(quad, h.at)}
    <div class="rotate" data-testid="frame-selection-rotate" data-rotate={i} style={`left:${h.at[0] + ux * ROTATE_REACH_PX}px;top:${h.at[1] + uy * ROTATE_REACH_PX}px`} onpointerdown={(e) => ongrab(Grip.Rotate, i, e)} role="presentation"></div>
  {/each}
  {#each handles as h, i (i)}
    <div class="handle" data-testid="frame-selection-handle" data-handle={i} style={`left:${h.at[0]}px;top:${h.at[1]}px`} onpointerdown={(e) => ongrab(Grip.Scale, i, e)} role="presentation"></div>
  {/each}
</div>

<style>
  .selection {
    position: absolute;
    box-sizing: border-box;
    border: 1px solid var(--ui-accent, #3b82f6);
    pointer-events: none;
  }

  .group {
    border-style: dashed;
  }

  .body {
    position: absolute;
    inset: 0;
    cursor: move;
    pointer-events: auto;
  }

  .group .body {
    pointer-events: none;
  }

  .handle {
    position: absolute;
    width: 8px;
    height: 8px;
    transform: translate(-50%, -50%);
    background: var(--ui-bg, #fff);
    border: 1px solid var(--ui-accent, #3b82f6);
    border-radius: var(--ui-radius-xs, 2px);
    pointer-events: auto;
  }

  .rotate {
    position: absolute;
    width: 20px;
    height: 20px;
    transform: translate(-50%, -50%);
    cursor: grab;
    pointer-events: auto;
  }
</style>
