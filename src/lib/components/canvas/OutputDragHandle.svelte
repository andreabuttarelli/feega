<script lang="ts">
  import FrameIcon from '@lucide/svelte/icons/frame';
  import { CANVAS_DRAG_OUTPUT } from '$lib/canvas/drag-payload';

  let { nodeId }: { nodeId: string } = $props();

  const TO_FRAME = 'Drag into a frame';

  function dragOutput(e: DragEvent) {
    e.stopPropagation();
    e.dataTransfer?.setData(CANVAS_DRAG_OUTPUT, nodeId);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'copy';
    }
  }
</script>

<button type="button" class="handle nodrag nopan" draggable="true" title={TO_FRAME} aria-label={TO_FRAME} data-testid="drag-to-frame" ondragstart={dragOutput} onpointerdown={(e) => e.stopPropagation()}><FrameIcon size={14} /></button>

<style>
  .handle {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 2;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border: 1px solid var(--line-2, #d2d2d7);
    border-radius: 9999px;
    background: var(--paper, #fff);
    color: var(--ink, #1d1d1f);
    cursor: grab;
    opacity: 0;
    transition: opacity 120ms ease;
  }
  :global(.gen-body:hover) .handle,
  :global(.gpu-node:hover) .handle,
  .handle:focus-visible {
    opacity: 1;
  }
  @media (hover: none) {
    .handle {
      opacity: 1;
    }
  }
</style>
