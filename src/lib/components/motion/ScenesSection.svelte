<script lang="ts">
  import type { MotionDoc } from '$lib/motion/doc';
  import type { OpResult } from '$lib/motion/timeline';
  import { JUNCTION, JUNCTION_KINDS, type JunctionKind } from '$lib/motion/junction-model';
  import { removeScene, reorderScenes, sceneTransition, scenesOf, trimScene } from '$lib/motion/scenes';

  let { doc, onchange }: { doc: MotionDoc; onchange: (result: OpResult, summary: string) => void } = $props();

  const NONE = 'none';
  const TRANSITION_SECONDS = 0.5;
  const scenes = $derived(scenesOf(doc));
  const seconds = (frames: number) => Math.round((frames / doc.fps) * 100) / 100;
  let dragging = $state<string | null>(null);

  function dropOn(target: string) {
    const from = dragging;
    dragging = null;
    if (!from || from === target) {
      return;
    }
    const ids = scenes.map((s) => s.clipId).filter((id) => id !== from);
    ids.splice(ids.indexOf(target) + (scenes.findIndex((s) => s.clipId === from) < scenes.findIndex((s) => s.clipId === target) ? 1 : 0), 0, from);
    onchange(reorderScenes(doc, ids), 'Reordered scenes');
  }

  function trim(clipId: string, value: number) {
    onchange(trimScene(doc, clipId, Math.max(1, Math.round(value * doc.fps))), 'Trimmed a scene');
  }

  function transition(clipId: string, kind: string) {
    const junction = kind === NONE ? null : { kind: kind as JunctionKind, durationInFrames: Math.round(TRANSITION_SECONDS * doc.fps) };
    onchange(sceneTransition(doc, clipId, junction), 'Scene transition');
  }
</script>

{#if scenes.length}
  <section class="scenes" data-testid="scenes-section">
    <header>Scenes</header>
    {#each scenes as scene, i (scene.clipId)}
      <div
        class="scene"
        class:dragging={dragging === scene.clipId}
        role="listitem"
        draggable="true"
        data-testid="scene-row"
        data-scene={scene.nodeId}
        ondragstart={() => (dragging = scene.clipId)}
        ondragover={(e) => e.preventDefault()}
        ondrop={() => dropOn(scene.clipId)}
      >
        <div class="row">
          <strong>Scene {i + 1}</strong>
          <button type="button" class="remove" aria-label={`Remove scene ${i + 1}`} onclick={() => onchange(removeScene(doc, scene.clipId), 'Removed a scene')}>Remove</button>
        </div>
        <div class="row">
          <label>Length <input type="number" min="0.1" step="0.1" value={seconds(scene.durationInFrames)} data-testid="scene-length" onchange={(e) => trim(scene.clipId, Number(e.currentTarget.value))} /> s</label>
          {#if i > 0}
            <select aria-label={`Transition into scene ${i + 1}`} data-testid="scene-transition" value={scene.junction?.kind ?? NONE} onchange={(e) => transition(scene.clipId, e.currentTarget.value)}>
              <option value={NONE}>Cut</option>
              {#each JUNCTION_KINDS as kind (kind)}<option value={kind}>{JUNCTION[kind].label}</option>{/each}
            </select>
          {/if}
        </div>
      </div>
    {/each}
  </section>
{/if}

<style>
  .scenes {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    padding: var(--ui-space-3) var(--ui-space-4);
    border-top: 1px solid var(--ui-line);
    font-size: var(--ui-type-caption);
  }

  header {
    font-weight: 600;
    color: var(--ui-text);
  }

  .scene {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-1);
    padding: var(--ui-space-2);
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-surface);
    cursor: grab;
  }

  .scene.dragging {
    opacity: 0.5;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ui-space-2);
  }

  input,
  select {
    min-width: 0;
    box-sizing: border-box;
    padding: 4px 6px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-surface);
    color: var(--ui-text);
  }

  input {
    width: 64px;
  }

  .remove {
    border: none;
    background: none;
    color: var(--ui-text-muted, var(--ui-text));
    cursor: pointer;
  }
</style>
