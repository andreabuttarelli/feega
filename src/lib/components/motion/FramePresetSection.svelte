<script lang="ts">
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import { FRAME_PRESETS, PRESET_LABEL, PRESET_SIZE, applyPreset, presetOf, resizeTo, type FramePreset } from '$lib/motion/frame-presets';
  import type { OpResult } from '@feega/motion-core/motion/timeline';

  const CUSTOM = 'custom';

  let { doc, onchange }: { doc: MotionDoc; onchange: (result: OpResult, summary: string) => void } = $props();

  const current = $derived(presetOf(doc) ?? CUSTOM);

  function pick(value: string) {
    if (value === CUSTOM) {
      return;
    }
    onchange(applyPreset(doc, value as FramePreset), `Resized the frame to ${PRESET_LABEL[value as FramePreset]}`);
  }

  function resize(side: 'width' | 'height', raw: string) {
    const value = Math.round(Number(raw));
    if (!Number.isFinite(value) || value === doc[side]) {
      return;
    }
    const size = { width: doc.width, height: doc.height, [side]: value };
    onchange(resizeTo(doc, size), `Resized the frame to ${size.width} × ${size.height}`);
  }
</script>

<div class="preset" data-testid="frame-preset-section">
  <label for="frame-preset">Frame size</label>
  <select id="frame-preset" data-testid="frame-preset" value={current} onchange={(e) => pick(e.currentTarget.value)}>
    {#if current === CUSTOM}<option value={CUSTOM}>{doc.width} × {doc.height}</option>{/if}
    {#each FRAME_PRESETS as preset (preset)}
      <option value={preset}>{PRESET_LABEL[preset]} {PRESET_SIZE[preset].width} × {PRESET_SIZE[preset].height}</option>
    {/each}
  </select>
</div>
<div class="size">
  <label>W <input type="number" min="1" data-testid="frame-width" aria-label="Frame width" value={doc.width} onchange={(e) => resize('width', e.currentTarget.value)} /></label>
  <label>H <input type="number" min="1" data-testid="frame-height" aria-label="Frame height" value={doc.height} onchange={(e) => resize('height', e.currentTarget.value)} /></label>
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
