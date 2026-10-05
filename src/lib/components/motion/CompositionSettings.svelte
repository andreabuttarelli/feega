<script lang="ts">
  import { FRAME_RATES, type FrameRate } from '$lib/motion/design';
  import { setFrameRate } from '$lib/motion/frame-rate';
  import { setMotionBlur } from '$lib/motion/motion-blur-ops';
  import { Background, FORMATS, MOTION_FORMATS, MAX_SECONDS, formatOf, type MotionDoc, type MotionFormat } from '$lib/motion/doc';
  import { setCanvas, type OpResult } from '$lib/motion/timeline';
  import { parseDecimal, secondsLabel } from '$lib/motion/inspector';

  let { doc, onchange }: { doc: MotionDoc; onchange: (result: OpResult, summary: string) => void } = $props();

  function setDuration(text: string) {
    const seconds = parseDecimal(text);
    if (seconds === null) {
      return;
    }
    onchange(setCanvas(doc, { durationInFrames: Math.round(seconds * doc.fps) }), 'Changed duration');
  }
</script>

<div class="settings" data-testid="composition-settings">
  <label>
    <span>Format</span>
    <select value={formatOf(doc)} onchange={(e) => onchange(setCanvas(doc, { format: e.currentTarget.value as MotionFormat }), 'Changed format')}>
      {#each MOTION_FORMATS as format (format)}<option value={format}>{FORMATS[format].label} · {FORMATS[format].width}×{FORMATS[format].height}</option>{/each}
    </select>
  </label>
  <label>
    <span>Length</span>
    <span class="unit-field">
      <input type="text" inputmode="decimal" title={`1–${MAX_SECONDS} s`} value={secondsLabel(doc.durationInFrames, doc.fps)} onchange={(e) => setDuration(e.currentTarget.value)} data-testid="length" />
      <em>s</em>
    </span>
  </label>
  <label>
    <span>Frame rate</span>
    <select value={doc.fps} onchange={(e) => onchange(setFrameRate(doc, Number(e.currentTarget.value) as FrameRate), 'Changed frame rate')} data-testid="frame-rate">
      {#each FRAME_RATES as rate (rate)}<option value={rate}>{rate} fps</option>{/each}
    </select>
  </label>
  <label>
    <span>Background</span>
    <select value={doc.background} onchange={(e) => onchange(setCanvas(doc, { background: e.currentTarget.value as Background }), 'Changed background')} data-testid="background">
      <option value={Background.Brand}>Brand</option>
      <option value={Background.Transparent}>Transparent</option>
    </select>
  </label>
  <label class="toggle" title="Real motion blur on server renders; the browser export takes 2 samples, the preview none">
    <span>Motion blur</span>
    <input type="checkbox" checked={doc.motionBlur.enabled} onchange={(e) => onchange(setMotionBlur(doc, { enabled: e.currentTarget.checked }), 'Changed motion blur')} data-testid="motion-blur" />
  </label>
  {#if doc.motionBlur.enabled}
    <label>
      <span>Shutter</span>
      <span class="unit-field">
        <input type="number" min="1" max="360" value={doc.motionBlur.shutterAngle} onchange={(e) => onchange(setMotionBlur(doc, { shutterAngle: Number(e.currentTarget.value) }), 'Changed shutter angle')} data-testid="shutter-angle" />
        <em>°</em>
      </span>
    </label>
    <label>
      <span>Phase</span>
      <span class="unit-field">
        <input type="number" min="-360" max="360" value={doc.motionBlur.shutterPhase} onchange={(e) => onchange(setMotionBlur(doc, { shutterPhase: Number(e.currentTarget.value) }), 'Changed shutter phase')} data-testid="shutter-phase" />
        <em>°</em>
      </span>
    </label>
    <label>
      <span>Samples</span>
      <input type="number" min="2" max="32" value={doc.motionBlur.samples} onchange={(e) => onchange(setMotionBlur(doc, { samples: Number(e.currentTarget.value) }), 'Changed blur samples')} data-testid="blur-samples" />
    </label>
  {/if}
</div>

<style>
  .settings {
    display: grid;
    gap: 6px;
    font-size: var(--ui-text-sm);
  }

  label {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    align-items: center;
    gap: var(--ui-space-2);
    color: var(--ui-ink-2);
  }

  .toggle input {
    justify-self: start;
    margin: 0;
  }

  select,
  input:not([type='checkbox']) {
    width: 100%;
    height: 24px;
    padding: 0 6px;
    border: 1px solid var(--ui-line-strong);
    border-radius: 0;
    background: var(--ui-bg);
    color: var(--ui-ink);
    font-family: var(--ui-mono);
    font-size: var(--ui-text-xs);
    font-variant-numeric: tabular-nums;
  }

  select:focus-visible,
  input:focus-visible {
    outline: none;
    border-color: var(--ui-accent);
  }

  .unit-field {
    position: relative;
    display: block;
  }

  .unit-field em {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    font-style: normal;
    font-size: 10px;
    color: var(--ui-ink-3);
    pointer-events: none;
  }
</style>
