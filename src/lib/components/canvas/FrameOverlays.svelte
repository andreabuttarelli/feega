<script lang="ts" module>
  export type OverlayFrame = FrameBox & { id: string; doc: DocSize; rotation?: number };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Viewport } from '$lib/canvas/dot-grid';
  import { frameScreenRect, type DocSize, type FrameBox } from '$lib/canvas/frame-screen';

  let { view, frames, children }: { view: Viewport; frames: OverlayFrame[]; children: Snippet<[OverlayFrame]> } = $props();

  const zoom = $derived(view.zoom);
  const scaled = $derived({ x: 0, y: 0, zoom });
</script>

<div class="overlays" data-testid="frame-overlays">
  <div class="pan" style:transform={`translate(${view.x}px, ${view.y}px)`}>
    {#each frames as frame (frame.id)}
      {@const r = frameScreenRect(scaled, frame)}
      <div class="frame" data-frame={frame.id} data-turn={frame.rotation || undefined} style={`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px${frame.rotation ? `;rotate:${frame.rotation}deg;transform-origin:50% 50%` : ''}`}>
        {@render children(frame)}
      </div>
    {/each}
  </div>
</div>

<style>
  .overlays {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 2;
  }

  .pan {
    position: absolute;
    left: 0;
    top: 0;
    will-change: transform;
  }

  .frame {
    position: absolute;
    pointer-events: none;
  }
</style>
