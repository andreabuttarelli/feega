<script lang="ts">
  import BoxIcon from '@lucide/svelte/icons/box';
  import RotateIcon from '@lucide/svelte/icons/rotate-3d';
  import NodeDownload from './NodeDownload.svelte';
  import { MediaOrigin } from '$lib/canvas/download';
  import type { Model3dScene } from '$lib/canvas/model3d-scene';

  let {
    src,
    nodeId,
    poster = null,
    onrender
  }: {
    src: string;
    nodeId: string;
    poster?: string | null;
    onrender?: (views: Blob[]) => Promise<void> | void;
  } = $props();

  let stage = $state<HTMLDivElement | null>(null);
  let scene = $state<Model3dScene | null>(null);
  let failed = $state(false);
  let autoRotate = $state(true);
  let rendering = $state(false);

  $effect(() => {
    if (!stage) {
      return;
    }
    const host = stage;
    let mounted: Model3dScene | null = null;
    let cancelled = false;

    const visible = new IntersectionObserver(async ([entry]) => {
      if (!entry?.isIntersecting || mounted || cancelled) {
        return;
      }
      visible.disconnect();
      try {
        const { mountModel3d } = await import('$lib/canvas/model3d-scene');
        mounted = await mountModel3d(host, src);
        if (cancelled) {
          mounted.dispose();
          return;
        }
        scene = mounted;
      } catch {
        failed = true;
      }
    });
    visible.observe(host);

    return () => {
      cancelled = true;
      visible.disconnect();
      mounted?.dispose();
      scene = null;
    };
  });

  function toggleRotate() {
    autoRotate = !autoRotate;
    scene?.setAutoRotate(autoRotate);
  }

  async function renderViews() {
    if (!scene || !onrender) {
      return;
    }
    rendering = true;
    try {
      await onrender(await scene.renderViews());
    } finally {
      rendering = false;
    }
  }
</script>

<div class="model3d" data-testid="model3d-viewer">
  <div class="model3d-stage nodrag nowheel nopan" bind:this={stage}>
    {#if !scene}
      {#if poster}
        <img class="model3d-poster" src={poster} alt="3D model preview" />
      {:else}
        <div class="model3d-placeholder" data-testid="model3d-placeholder">
          <BoxIcon size={28} strokeWidth={1.5} />
          <span>{failed ? 'The model could not be opened' : 'Loading 3D model…'}</span>
        </div>
      {/if}
    {/if}
  </div>

  <div class="model3d-bar nodrag">
    <button type="button" aria-label="Auto-rotate" aria-pressed={autoRotate} class:is-on={autoRotate} onclick={toggleRotate} disabled={!scene}>
      <RotateIcon size={14} strokeWidth={2} />
    </button>
    {#if onrender}
      <button type="button" class="model3d-render" onclick={renderViews} disabled={!scene || rendering}>
        {rendering ? 'Rendering…' : 'Render views'}
      </button>
    {/if}
    <NodeDownload kind="model3d" sourceUrl={src} {nodeId} nodeType="model3d" origin={MediaOrigin.Generated} />
  </div>
</div>

<style>
  .model3d {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .model3d-stage {
    position: relative;
    flex: 1;
    min-height: 0;
    background: #f4f4f2;
    overflow: hidden;
  }

  .model3d-stage :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }

  .model3d-poster {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .model3d-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 100%;
    color: var(--ink-3, #6b7280);
    font-size: 12px;
  }

  .model3d-bar {
    position: absolute;
    top: 6px;
    right: 6px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .model3d-bar button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding: 0 8px;
    border: 1px solid var(--line, #e5e5e5);
    border-radius: 0;
    background: var(--paper, #fff);
    font-size: 12px;
    cursor: pointer;
  }

  .model3d-bar button.is-on {
    background: var(--ink, #111);
    color: var(--paper, #fff);
  }

  .model3d-bar button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
