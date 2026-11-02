<script lang="ts">
  import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import { IN_OUT_PRESETS, PRESET_PLACE_LABEL, PresetPlace, PresetSide, applyInOut, presetStart, presetsFor, type InOutPreset } from '$lib/motion/in-out-presets';
  import { presetPlace } from '$lib/motion/preset-place.svelte';

  let { doc, clip, frame, commit }: { doc: MotionDoc; clip: MotionClip; frame: number; commit: (result: OpResult, summary: string) => void } = $props();

  const SIDE_LABEL: Record<PresetSide, string> = { [PresetSide.In]: 'In', [PresetSide.Out]: 'Out' };

  let side = $state<PresetSide>(PresetSide.In);

  const choices = $derived(presetsFor(clip.component, side));

  function run(preset: InOutPreset) {
    const at = presetPlace.current === PresetPlace.Playhead ? presetStart(PresetPlace.Playhead, frame, clip) : undefined;
    commit(applyInOut(doc, clip.id, { preset, side, at }, () => crypto.randomUUID().slice(0, 8)), `${IN_OUT_PRESETS[preset].label} ${side}`);
  }
</script>

<section class="presets" data-testid="in-out-presets">
  <div class="head">
    <h4>In / Out</h4>
    <div class="seg" role="group" aria-label="Preset side">
      {#each Object.values(PresetSide) as s (s)}
        <button type="button" class:on={side === s} aria-pressed={side === s} data-testid={`preset-side-${s}`} onclick={() => (side = s)}>{SIDE_LABEL[s]}</button>
      {/each}
    </div>
    <div class="seg" role="group" aria-label="Preset position">
      {#each Object.values(PresetPlace) as w (w)}
        <button type="button" class:on={presetPlace.current === w} aria-pressed={presetPlace.current === w} data-testid={`preset-where-${w}`} onclick={() => (presetPlace.current = w)}>{PRESET_PLACE_LABEL[w]}</button>
      {/each}
    </div>
  </div>
  <div class="chips">
    {#each choices as preset (preset)}
      <button type="button" class="chip" data-testid={`preset-${preset}`} onclick={() => run(preset)}>{IN_OUT_PRESETS[preset].label}</button>
    {/each}
  </div>
</section>

<style>
  .presets {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
  }

  .head {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
  }

  h4 {
    margin: 0;
    margin-right: auto;
  }

  .seg {
    display: flex;
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  button {
    padding: 2px 6px;
    border: 1px solid var(--ui-line);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font: inherit;
    cursor: pointer;
  }

  .on {
    background: var(--ui-ink);
    color: var(--ui-bg);
  }
</style>
