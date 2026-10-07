<script lang="ts">
  import type { MotionDoc } from '$lib/motion/doc';
  import type { Effect } from '$lib/motion/effects/model';
  import { LUT_PRESETS, LUT_PRESET_IDS, applyLut, compileLut, lutFromCube, type LutPreset } from '$lib/motion/effects/lut';
  import type { OpResult } from '$lib/motion/timeline';

  let { doc, clipId, effect, onchange }: { doc: MotionDoc; clipId: string; effect: Effect; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  let error = $state('');
  const CUBE_EXT = /\.cube$/i;

  function commit(result: OpResult, summary: string) {
    if (!result.ok) {
      error = result.error;
      return;
    }
    error = '';
    onchange(result.doc, summary);
  }

  function pick(select: HTMLSelectElement) {
    const preset = select.value as LutPreset;
    if (preset) {
      commit(applyLut(doc, clipId, effect.id, compileLut(LUT_PRESETS[preset].look, preset)), `LUT ${LUT_PRESETS[preset].label}`);
    }
  }

  async function load(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    const lut = lutFromCube(await file.text(), file.name.replace(CUBE_EXT, ''));
    if (typeof lut === 'string') {
      error = lut;
      return;
    }
    commit(applyLut(doc, clipId, effect.id, lut), `Loaded ${file.name}`);
  }
</script>

<div class="lut" data-testid="lut-picker">
  <select aria-label="LUT preset" value={LUT_PRESET_IDS.find((p) => p === effect.lut?.name) ?? ''} onchange={(e) => pick(e.currentTarget)}>
    <option value="">{effect.lut ? effect.lut.name : 'No LUT'}</option>
    {#each LUT_PRESET_IDS as preset (preset)}<option value={preset}>{LUT_PRESETS[preset].label}</option>{/each}
  </select>
  <label class="file">Load .cube<input type="file" accept=".cube" onchange={(e) => load(e.currentTarget)} /></label>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
  .lut {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--ui-space-1);
    padding: var(--ui-space-1) 0;
    font-size: var(--ui-text-sm);
  }

  .file {
    padding: var(--ui-space-1) var(--ui-space-2);
    border: 1px solid var(--ui-line-strong);
    background: var(--ui-bg);
    color: var(--ui-ink);
    cursor: pointer;
  }

  .file:hover {
    background: var(--ui-hover);
  }

  .file input {
    display: none;
  }

  .error {
    flex-basis: 100%;
    margin: 0;
    color: var(--ui-ink);
  }
</style>
