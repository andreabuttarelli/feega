<script lang="ts">
  import Diamond from '@lucide/svelte/icons/diamond';
  import { componentPreview, type PreviewAsk } from '$lib/canvas/component-previews';
  import type { Tone } from '$lib/canvas/component-preview';

  let { ask }: { ask: PreviewAsk } = $props();

  let canvas = $state<HTMLCanvasElement | null>(null);
  let seen = $state(false);
  let drawn = $state(false);
  let tone = $state<Tone | null>(null);

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
    void componentPreview(wanted, (preview) => {
      if (!live) {
        return;
      }
      target.width = preview.width;
      target.height = preview.height;
      target.getContext('2d')?.drawImage(preview.bitmap, 0, 0);
      tone = preview.tone;
      drawn = true;
    });
    return () => {
      live = false;
    };
  });
</script>

<div class="preview" data-testid="component-preview" data-tone={tone}>
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

  .preview[data-tone='dark'] {
    background: #1e1e1e;
  }

  .preview[data-tone='light'] {
    background: #f5f5f5;
  }

  .preview :global(svg) {
    position: absolute;
    opacity: 0.6;
  }

  canvas {
    max-width: 100%;
    max-height: 100%;
    visibility: hidden;
  }

  canvas.drawn {
    visibility: visible;
  }
</style>
