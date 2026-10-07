<script lang="ts">
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { DEVICE, type Device } from '$lib/motion/devices';
  import { DEVICE_PRESETS, PRESET, addDeviceRow, applyDevicePreset, type DevicePreset } from '$lib/motion/device-presets';
  import type { OpResult } from '$lib/motion/timeline';

  let { doc, clip, onchange }: { doc: MotionDoc; clip: MotionClip; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  let error = $state('');
  const device = $derived((clip.props as { device: Device }).device);
  const fitting = $derived(DEVICE_PRESETS.filter((p) => PRESET[p].fits(DEVICE[device].kind)));

  function commit(result: OpResult, summary: string) {
    if (!result.ok) {
      error = result.error;
      return;
    }
    error = '';
    onchange(result.doc, summary);
  }

  function row() {
    const screen = (clip.props as { screen: string | null }).screen;
    const ids = [1, 2, 3].map((i) => `${clip.id}-row${i}`);
    commit(addDeviceRow(doc, { device, screens: [screen], from: clip.from, durationInFrames: clip.durationInFrames, ids }), 'Added a row of devices');
  }

  const label = (preset: DevicePreset) => preset.replace('-', ' ');
</script>

<section class="presets" data-testid="device-presets">
  <h4>Device animation</h4>
  <div class="buttons">
    {#each fitting as preset (preset)}
      <button type="button" title={PRESET[preset].about} data-preset={preset} onclick={() => commit(applyDevicePreset(doc, clip.id, preset), `Device ${label(preset)}`)}>{label(preset)}</button>
    {/each}
    <button type="button" title="Three staggered devices turning at different rates" onclick={row}>row of three</button>
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
  .presets {
    padding: 8px 12px 12px;
    border-top: 1px solid var(--ui-line);
    font-size: var(--ui-text-sm);
  }

  h4 {
    margin: 0 0 6px;
    font-family: var(--ui-mono);
    font-size: 10px;
    font-weight: 400;
    text-transform: uppercase;
    color: var(--ui-ink-2);
  }

  .buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  button {
    padding: 5px 10px;
    border: 1px solid var(--ui-line-strong);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font: inherit;
    text-transform: capitalize;
  }

  button:hover {
    background: var(--ui-hover);
  }

  .error {
    color: #c62828;
    margin: 6px 0 0;
  }
</style>
