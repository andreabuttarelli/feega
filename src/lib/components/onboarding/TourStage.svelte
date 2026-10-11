<script lang="ts">
  import { tick, type Component } from 'svelte';
  import { TourScene } from '$lib/onboarding/tour';
  import { PORTRAIT, STAGE, StageLayout, portraitWorld, stageLayout, stageScale } from '$lib/onboarding/stage';
  import MakeScene from './scenes/MakeScene.svelte';
  import EditScene from './scenes/EditScene.svelte';
  import CanvasScene from './scenes/CanvasScene.svelte';
  import ConnectScene from './scenes/ConnectScene.svelte';
  import ShareScene from './scenes/ShareScene.svelte';
  import StartScene from './scenes/StartScene.svelte';
  import MakePortrait from './scenes/portrait/MakePortrait.svelte';
  import EditPortrait from './scenes/portrait/EditPortrait.svelte';
  import CanvasPortrait from './scenes/portrait/CanvasPortrait.svelte';
  import ConnectPortrait from './scenes/portrait/ConnectPortrait.svelte';
  import SharePortrait from './scenes/portrait/SharePortrait.svelte';
  import StartPortrait from './scenes/portrait/StartPortrait.svelte';

  let { scene }: { scene: TourScene } = $props();

  const SCENES: Record<StageLayout, Record<TourScene, Component>> = {
    [StageLayout.Landscape]: {
      [TourScene.Make]: MakeScene,
      [TourScene.Edit]: EditScene,
      [TourScene.Canvas]: CanvasScene,
      [TourScene.Connect]: ConnectScene,
      [TourScene.Share]: ShareScene,
      [TourScene.Start]: StartScene
    },
    [StageLayout.Portrait]: {
      [TourScene.Make]: MakePortrait,
      [TourScene.Edit]: EditPortrait,
      [TourScene.Canvas]: CanvasPortrait,
      [TourScene.Connect]: ConnectPortrait,
      [TourScene.Share]: SharePortrait,
      [TourScene.Start]: StartPortrait
    }
  };

  let width = $state(0);
  let height = $state(0);
  let world = $state<HTMLElement | null>(null);

  const layout = $derived(stageLayout(width));
  const Scene = $derived(SCENES[layout][scene]);
  const size = $derived.by(() => {
    if (layout === StageLayout.Portrait) {
      const fit = portraitWorld({ width, height });
      return { width: PORTRAIT.width, height: fit.height, scale: fit.scale };
    }
    return { width: STAGE.width, height: STAGE.height, scale: stageScale({ width, height }) };
  });

  function startTogether(root: HTMLElement) {
    const now = document.timeline.currentTime;
    for (const animation of root.getAnimations({ subtree: true })) {
      animation.startTime = now;
    }
  }

  $effect(() => {
    void Scene;
    const root = world;
    if (!root) {
      return;
    }
    tick().then(() => startTogether(root));
  });
</script>

<div class="stage" bind:clientWidth={width} bind:clientHeight={height} data-testid="tour-art" data-scene={scene} data-layout={layout} aria-hidden="true">
  <div class="world" bind:this={world} style:width="{size.width}px" style:height="{size.height}px" style:transform="translate(-50%, -50%) scale({size.scale})">
    {#key Scene}
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

  @keyframes -global-tour-seam {
    0% { opacity: 0; }
    4%, 95% { opacity: 1; }
    100% { opacity: 0; }
  }
</style>
