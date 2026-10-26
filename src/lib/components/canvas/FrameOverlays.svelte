<script lang="ts" module>
  export type OverlayFrame = FrameBox & { id: string; doc: DocSize; rotation?: number };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Viewport } from '$lib/canvas/dot-grid';
  import { frameScreenRect, type DocSize, type FrameBox } from '$lib/canvas/frame-screen';

  let { view, frames, children }: { view: Viewport; frames: OverlayFrame[]; children: Snippet<[OverlayFrame]> } = $props();
</script>

<div class="overlays" data-testid="frame-overlays">
  {#each frames as frame (frame.id)}
    {@const r = frameScreenRect(view, frame)}
    <div class="frame" data-frame={frame.id} data-turn={frame.rotation || undefined} style={`left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px${frame.rotation ? `;rotate:${frame.rotation}deg;transform-origin:50% 50%` : ''}`}>
      {@render children(frame)}
    </div>
  {/each}
</div>

<style>
  .overlays {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 2;
  }

  .frame {
    position: absolute;
    pointer-events: none;
  }
</style>
