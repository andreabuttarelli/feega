<script lang="ts">
  import { Grip, handlesOf, type Quad } from '$lib/motion/scene-select';

  type Rect = { left: number; top: number; width: number; height: number };

  let { clip, rect, ongrab }: { clip: string; rect: Rect; ongrab: (grip: Grip, handle: number, e: PointerEvent) => void } = $props();

  const quad = $derived<Quad>([
    [0, 0],
    [rect.width, 0],
    [rect.width, rect.height],
    [0, rect.height]
  ]);
  const handles = $derived(handlesOf(quad));
</script>

<div class="selection" data-testid="frame-selection" data-clip={clip} style={`left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`}>
  <div class="body" data-testid="frame-selection-body" onpointerdown={(e) => ongrab(Grip.Move, 0, e)} role="presentation"></div>
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

  .body {
    position: absolute;
    inset: 0;
    cursor: move;
    pointer-events: auto;
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
</style>
