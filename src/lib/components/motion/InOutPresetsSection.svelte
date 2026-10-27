<script lang="ts">
  import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
  import type { OpResult } from '@feega/motion-core/motion/timeline';
  import { IN_OUT_PRESETS, PresetSide, applyInOut, presetsFor, type InOutPreset } from '$lib/motion/in-out-presets';

  let { doc, clip, frame, commit }: { doc: MotionDoc; clip: MotionClip; frame: number; commit: (result: OpResult, summary: string) => void } = $props();

  const Where = { Edge: 'edge', Playhead: 'playhead' } as const;
  type Where = (typeof Where)[keyof typeof Where];

  const SIDE_LABEL: Record<PresetSide, string> = { [PresetSide.In]: 'In', [PresetSide.Out]: 'Out' };
  const WHERE_LABEL: Record<Where, string> = { [Where.Edge]: 'Clip edge', [Where.Playhead]: 'Playhead' };

  let side = $state<PresetSide>(PresetSide.In);
  let where = $state<Where>(Where.Edge);

  const choices = $derived(presetsFor(clip.component, side));

  function run(preset: InOutPreset) {
    const at = where === Where.Playhead ? Math.max(0, frame - clip.from) : undefined;
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
      {#each Object.values(Where) as w (w)}
        <button type="button" class:on={where === w} aria-pressed={where === w} data-testid={`preset-where-${w}`} onclick={() => (where = w)}>{WHERE_LABEL[w]}</button>
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
