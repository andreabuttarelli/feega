<script lang="ts">
  import { Grip, handlesOf, type Pt, type Quad } from '$lib/motion/scene-select';
  import { outwardOf } from '$lib/motion/element-gesture';
  import { SelectionKind } from '$lib/canvas/frame-transform';
  import { ROTATE_CURSOR, resizeCursor } from '$lib/canvas/resize-cursor';
  import { quadBox, quadStyle, type ScreenQuad } from '$lib/canvas/quad-box';

  let { clip, quad: drawn, kind = SelectionKind.Element, ongrab, turn = 0 }: { clip: string; quad: ScreenQuad; kind?: SelectionKind; turn?: number; ongrab: (grip: Grip, handle: number, e: PointerEvent) => void } = $props();

  const ROTATE_REACH_PX = 14;
  const rect = $derived(quadBox(drawn));
  const TESTID: Record<SelectionKind, string> = { [SelectionKind.Element]: 'frame-selection', [SelectionKind.Member]: 'frame-selection', [SelectionKind.Group]: 'frame-group-selection' };

  const quad = $derived<Quad>([
    [0, 0],
    [rect.width, 0],
    [rect.width, rect.height],
    [0, rect.height]
  ]);
  const handles = $derived(kind === SelectionKind.Member ? [] : handlesOf(quad));
  const corners = $derived(handles.slice(0, 4));
  const sides = $derived(handles.slice(4).map((h, i) => ({ ...h, index: i + 4 })));
  const cursorOf = ([u, v]: Pt) => resizeCursor([u * 2 - 1, v * 2 - 1], turn + rect.degrees);
  const EDGE_PX = 8;
  const edgeBox = ([u, v]: Pt) =>
    u === 0.5 ? `left:0;width:100%;top:${v * rect.height - EDGE_PX / 2}px;height:${EDGE_PX}px` : `top:0;height:100%;left:${u * rect.width - EDGE_PX / 2}px;width:${EDGE_PX}px`;
</script>

<div class="selection" class:group={kind === SelectionKind.Group} data-testid={TESTID[kind]} data-clip={clip || undefined} style={quadStyle(drawn)}>
  <div class="body" data-testid="frame-selection-body" onpointerdown={(e) => ongrab(Grip.Move, 0, e)} role="presentation"></div>
  {#each corners as h, i (i)}
    {@const [ux, uy] = outwardOf(quad, h.at)}
    <div class="rotate" data-testid="frame-selection-rotate" data-rotate={i} style={`left:${h.at[0] + ux * ROTATE_REACH_PX}px;top:${h.at[1] + uy * ROTATE_REACH_PX}px;cursor:${ROTATE_CURSOR}`} onpointerdown={(e) => ongrab(Grip.Rotate, i, e)} role="presentation"></div>
  {/each}
  {#each sides as s (s.index)}
    <div class="edge" data-testid="frame-selection-edge" data-handle={s.index} style={`${edgeBox(s.unit)};cursor:${cursorOf(s.unit)}`} onpointerdown={(e) => ongrab(Grip.Scale, s.index, e)} role="presentation"></div>
  {/each}
  {#each handles as h, i (i)}
    <div class="handle" data-testid="frame-selection-handle" data-handle={i} style={`left:${h.at[0]}px;top:${h.at[1]}px;cursor:${cursorOf(h.unit)}`} onpointerdown={(e) => ongrab(Grip.Scale, i, e)} role="presentation"></div>
  {/each}
</div>

<style>
  .selection {
    position: absolute;
    box-sizing: border-box;
    border: 1px solid var(--ui-accent, #3b82f6);
    pointer-events: none;
    transform-origin: 0 0;
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

  .edge {
    position: absolute;
    pointer-events: auto;
  }

  .rotate {
    position: absolute;
    width: 20px;
    height: 20px;
    transform: translate(-50%, -50%);
    pointer-events: auto;
  }
</style>
