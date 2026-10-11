<script lang="ts">
  import type { Component } from 'svelte';
  import { TourScene } from '$lib/onboarding/tour';
  import { STAGE, stageScale } from '$lib/onboarding/stage';
  import MakeScene from './scenes/MakeScene.svelte';
  import EditScene from './scenes/EditScene.svelte';
  import CanvasScene from './scenes/CanvasScene.svelte';
  import ConnectScene from './scenes/ConnectScene.svelte';
  import ShareScene from './scenes/ShareScene.svelte';
  import StartScene from './scenes/StartScene.svelte';

  let { scene }: { scene: TourScene } = $props();

  const SCENES: Record<TourScene, Component> = {
    [TourScene.Make]: MakeScene,
    [TourScene.Edit]: EditScene,
    [TourScene.Canvas]: CanvasScene,
    [TourScene.Connect]: ConnectScene,
    [TourScene.Share]: ShareScene,
    [TourScene.Start]: StartScene
  };

  let width = $state(0);
  let height = $state(0);

  const scale = $derived(stageScale({ width, height }));
  const Scene = $derived(SCENES[scene]);
</script>

<div class="stage" bind:clientWidth={width} bind:clientHeight={height} data-testid="tour-art" data-scene={scene} aria-hidden="true">
  <div class="world" style:width="{STAGE.width}px" style:height="{STAGE.height}px" style:transform="translate(-50%, -50%) scale({scale})">
    {#key scene}
      <Scene />
    {/key}
  </div>
</div>

<style>
  .stage {
    position: relative;
    overflow: hidden;
    background-color: var(--ui-surface, #fafaf8);
    background-image: radial-gradient(circle, color-mix(in srgb, var(--ui-ink, #111) 14%, transparent) 1px, transparent 1.4px);
    background-size: 24px 24px;
    background-position: center;
  }

  .world {
    position: absolute;
    top: 50%;
    left: 50%;
    transform-origin: center;
  }
</style>
