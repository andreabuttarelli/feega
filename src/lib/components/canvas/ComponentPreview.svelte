<script lang="ts">
  import Diamond from '@lucide/svelte/icons/diamond';
  import { componentPreview, type PreviewAsk } from '$lib/canvas/component-previews';

  let { ask }: { ask: PreviewAsk } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  let seen = $state(false);
  let drawn = $state(false);

  $effect(() => {
    if (!canvas || seen) {
      return;
    }
    const watch = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        seen = true;
        watch.disconnect();
      }
    });
    watch.observe(canvas);
    return () => watch.disconnect();
  });

  $effect(() => {
    const target = canvas;
    const wanted = { ...ask };
    if (!target || !seen) {
      return;
    }
    let live = true;
    void componentPreview(wanted).then((bitmap) => {
      if (!live || !bitmap) {
        return;
      }
      target.width = bitmap.width;
      target.height = bitmap.height;
      target.getContext('2d')?.drawImage(bitmap, 0, 0);
      drawn = true;
    });
    return () => {
      live = false;
    };
  });
</script>

<div class="preview" data-testid="component-preview">
  <canvas bind:this={canvas} class:drawn></canvas>
  {#if !drawn}<Diamond size={16} />{/if}
</div>

<style>
  .preview {
    position: relative;
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-surface);
    color: #9747ff;
    overflow: hidden;
  }

  .preview :global(svg) {
    position: absolute;
    opacity: 0.6;
  }

  canvas {
    max-width: 84%;
    max-height: 84%;
    visibility: hidden;
  }

  canvas.drawn {
    visibility: visible;
  }
</style>
