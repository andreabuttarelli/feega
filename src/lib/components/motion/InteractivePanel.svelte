<script lang="ts">
  import { INTERACTIVE_PRESETS, PRESET, type InteractivePreset } from '$lib/motion/interactive/presets';

  let {
    active = $bindable(false),
    tiltX = $bindable(0),
    tiltY = $bindable(0),
    clipId,
    onpreset
  }: { active?: boolean; tiltX?: number; tiltY?: number; clipId: string | null; onpreset: (preset: InteractivePreset) => void } = $props();
</script>

<div class="interactive" data-testid="interactive-panel">
  <button type="button" class="toggle" aria-pressed={active} onclick={() => (active = !active)} data-testid="interactive-toggle">Interactive preview</button>
  {#if active}
    <label>Tilt X <input type="range" min="-1" max="1" step="0.01" bind:value={tiltX} data-testid="tilt-x" /></label>
    <label>Tilt Y <input type="range" min="-1" max="1" step="0.01" bind:value={tiltY} data-testid="tilt-y" /></label>
    {#each INTERACTIVE_PRESETS as preset (preset)}
      <button type="button" disabled={PRESET[preset].clip && !clipId} title={PRESET[preset].about} onclick={() => onpreset(preset)} data-testid={`preset-${preset}`}>{PRESET[preset].label}</button>
    {/each}
  {/if}
</div>

<style>
  .interactive {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    font-size: 12px;
    padding: 6px 0;
  }
  .toggle[aria-pressed='true'] {
    background: var(--ui-accent, #3b82f6);
    color: #fff;
  }
  label {
    display: flex;
    gap: 4px;
    align-items: center;
  }
  input[type='range'] {
    width: 80px;
  }
</style>
