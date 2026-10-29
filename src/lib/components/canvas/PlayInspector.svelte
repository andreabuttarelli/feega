<script lang="ts">
  import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import PrototypeSection from '$lib/components/motion/PrototypeSection.svelte';
  import FlowSection from '$lib/components/motion/FlowSection.svelte';
  import InteractivePanel from '$lib/components/motion/InteractivePanel.svelte';
  import { applyInteractivePreset } from '$lib/motion/interactive/presets';
  import { prototypePlayer } from '$lib/canvas/prototype-player.svelte';
  import { frameLive } from '$lib/canvas/frame-live.svelte';

  let { doc, clip, commit }: { doc: MotionDoc; clip: MotionClip | null; commit: (result: OpResult, summary: string) => void } = $props();

  const nodeId = $derived(prototypePlayer.editing);
  const live = $derived(!!nodeId && frameLive.id === nodeId);
</script>

<aside class="play-inspector" data-testid="play-inspector" aria-label="Play">
  {#if clip}<PrototypeSection {doc} {clip} {commit} />{/if}
  <FlowSection {doc} onchange={commit} />
  <section class="block" aria-label="Play this frame">
    <header>
      <h3>Play on canvas</h3>
      <button type="button" class="toggle" role="switch" aria-checked={live} aria-label="Play this frame live on the canvas" data-testid="play-frame-live" disabled={!nodeId} onclick={() => nodeId && frameLive.toggle(nodeId)}><span class="knob"></span></button>
    </header>
  </section>
  <section class="block" aria-label="Interactive">
    <h3>Interactive</h3>
    <InteractivePanel active tilt={false} clipId={clip?.id ?? null} onpreset={(preset) => commit(applyInteractivePreset(doc, preset, clip?.id ?? null), 'Added an interaction')} />
  </section>
</aside>

<style>
  .play-inspector {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    padding: var(--ui-space-3) var(--ui-space-4);
    border-top: 1px solid var(--ui-border);
    font-size: var(--ui-type-caption);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  h3 {
    margin: 0;
    font-size: var(--ui-type-caption);
    font-weight: 600;
  }

  .toggle {
    position: relative;
    width: 24px;
    height: 14px;
    padding: 0;
    border: 0;
    border-radius: 9999px;
    background: var(--ui-line, #d2d2d7);
    cursor: pointer;
  }

  .toggle:disabled {
    opacity: 0.4;
  }

  .toggle[aria-checked='true'] {
    background: var(--ui-accent, #0a84ff);
  }

  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 10px;
    height: 10px;
    border-radius: 9999px;
    background: #fff;
    transition: transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .toggle[aria-checked='true'] .knob {
    transform: translateX(10px);
  }
</style>
