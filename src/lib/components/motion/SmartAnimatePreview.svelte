<script lang="ts">
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import { smartAnimate } from '@feega/motion-core/motion/smart-animate/smart-animate';
  import { previewBox } from '$lib/motion/smart-animate/preview-box';

  let { source, target, easing, durationMs }: { source: MotionDoc; target: MotionDoc; easing: string; durationMs: number } = $props();

  const SHAPE = 'Shape';
  const WIDTH = 232;
  const height = $derived(Math.round((WIDTH * source.height) / source.width));
  let progress = $state(0);
  let frameId = 0;

  const layers = $derived(smartAnimate(source, target, progress, easing).map((layer) => ({ layer, box: previewBox(layer, { width: WIDTH, height }) })));

  function play() {
    cancelAnimationFrame(frameId);
    const startedAt = performance.now();
    const step = (now: number) => {
      progress = Math.min(1, (now - startedAt) / durationMs);
      frameId = progress < 1 ? requestAnimationFrame(step) : 0;
    };
    progress = 0;
    frameId = requestAnimationFrame(step);
  }

  $effect(() => () => cancelAnimationFrame(frameId));
</script>

<div class="preview" data-testid="smart-animate-preview">
  <div class="stage" style:width="{WIDTH}px" style:height="{height}px">
    {#each layers as { layer, box } (layer.role + layer.key)}
      <div
        class="layer"
        data-role={layer.role}
        data-layer={layer.key}
        style:left="{box.left}px"
        style:top="{box.top}px"
        style:width="{box.width}px"
        style:height="{box.height}px"
        class:outline={layer.component !== SHAPE}
        style:background={layer.component === SHAPE && box.fill.startsWith('#') ? box.fill : 'transparent'}
        style:border-radius="{box.radius}px"
        style:opacity={box.opacity}
        style:transform="rotate({box.rotation}deg)"
      ></div>
    {/each}
  </div>
  <div class="controls">
    <button type="button" data-testid="smart-animate-play" onclick={play}>Play</button>
    <input type="range" min="0" max="1" step="0.01" aria-label="Preview progress" bind:value={progress} />
  </div>
</div>

<style>
  .preview {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-1);
  }

  .stage {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--ui-border);
    background: var(--ui-bg);
  }

  .layer {
    position: absolute;
  }

  .outline {
    border: 1px dashed var(--ui-text-secondary);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
  }

  input {
    flex: 1;
    min-width: 0;
  }
</style>
