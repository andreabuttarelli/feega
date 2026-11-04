<script lang="ts">
  import { FRAME_PRESETS, PRESET_LABEL, PRESET_SIZE, presetOf, type FramePreset } from '$lib/motion/frame-presets';
  import type { NodePlace } from '$lib/components/canvas/frame-properties.svelte';
  import { FrameSizing } from '$lib/motion/frame-presets';

  const CUSTOM = 'custom';

  let { place, sizing = FrameSizing.Presets }: { place: NodePlace; sizing?: FrameSizing } = $props();

  const size = $derived({ width: Math.round(place.w), height: Math.round(place.h) });
  const current = $derived(presetOf(size) ?? CUSTOM);

  function pick(value: string) {
    if (value === CUSTOM) {
      return;
    }
    const { width, height } = PRESET_SIZE[value as FramePreset];
    place.resize(width, height);
  }

  function resize(side: 'width' | 'height', raw: string) {
    const value = Math.round(Number(raw));
    if (!Number.isFinite(value) || value < 1 || value === size[side]) {
      return;
    }
    const next = { ...size, [side]: value };
    place.resize(next.width, next.height);
  }
</script>

{#if sizing === FrameSizing.Presets}
<div class="preset" data-testid="frame-preset-section">
  <label for="frame-preset">Frame size</label>
  <select id="frame-preset" data-testid="frame-preset" value={current} onchange={(e) => pick(e.currentTarget.value)}>
    {#if current === CUSTOM}<option value={CUSTOM}>{size.width} × {size.height}</option>{/if}
    {#each FRAME_PRESETS as preset (preset)}
      <option value={preset}>{PRESET_LABEL[preset]} {PRESET_SIZE[preset].width} × {PRESET_SIZE[preset].height}</option>
    {/each}
  </select>
</div>
{/if}
<div class="size">
  <label>W <input type="number" min="1" data-testid="frame-width" aria-label="Frame width" value={size.width} onchange={(e) => resize('width', e.currentTarget.value)} /></label>
  <label>H <input type="number" min="1" data-testid="frame-height" aria-label="Frame height" value={size.height} onchange={(e) => resize('height', e.currentTarget.value)} /></label>
</div>

<style>
  .size {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--ui-space-2);
    padding: 0 var(--ui-space-4) var(--ui-space-4);
    border-bottom: 1px solid var(--ui-line);
    font-size: var(--ui-text-sm);
    color: var(--ui-text-2);
  }

  .size label {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    height: var(--ui-row);
    padding-left: 10px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
    transition: background-color var(--ui-dur-fast, 120ms) ease;
  }

  .size label:hover {
    background: var(--ui-input-hover);
  }

  .size label:focus-within {
    box-shadow: inset 0 0 0 1px var(--ui-accent);
  }

  .size input {
    min-width: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ui-text);
    font: inherit;
    outline: none;
    appearance: textfield;
  }

  .size input::-webkit-inner-spin-button,
  .size input::-webkit-outer-spin-button {
    appearance: none;
    margin: 0;
  }

  .preset {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ui-space-2);
    padding: var(--ui-space-4);
    border-bottom: 1px solid var(--ui-line);
    font-size: var(--ui-text-sm);
    color: var(--ui-text-2);
  }

  select {
    min-width: 0;
    flex: 1;
    height: var(--ui-row);
    padding: 0 10px;
    border: 1px solid transparent;
    border-radius: var(--ui-radius-md);
    background: var(--ui-input);
    color: var(--ui-ink);
    font: inherit;
  }
</style>
