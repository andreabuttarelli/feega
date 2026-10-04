<script lang="ts">
  import Pipette from '@lucide/svelte/icons/pipette';
  import { COMPONENTS } from '$lib/motion/components';
  import { FPS } from '$lib/motion/design';
  import { clipsOf, type DocVerdict, type MotionDoc } from '$lib/motion/doc';
  import { CAMERA, CAMERA_LANE, Space, type CameraKey } from '$lib/motion/camera';
  import { CAMERA_PRESETS, CameraPreset, PRESETS, applyPreset, cameraEditAt, cameraKeyToggle, cameraValueAt, focusOn, removeCamera, setCamera } from '$lib/motion/camera-ops';
  import { parseDecimal } from '$lib/motion/inspector';
  import Dial from './Dial.svelte';
  import SceneMap from './SceneMap.svelte';
  import { setCameraExpression } from '$lib/motion/expression/ops';
  import { expressionErrors } from '$lib/motion/expression/bake';

  let { doc, frame, onchange }: { doc: MotionDoc; frame: number; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  const GROUPS: { title: string; keys: CameraKey[] }[] = [
    { title: 'Position', keys: ['x', 'y', 'z'] },
    { title: 'Rotation', keys: ['rotateX', 'rotateY', 'rotateZ'] },
    { title: 'Lens', keys: ['fov'] }
  ];
  const DIALS = new Set<CameraKey>(['rotateX', 'rotateY', 'rotateZ']);
  const KEY_STATE = { On: 'on', Lane: 'lane', None: 'none' } as const;
  const DEFAULT_MOVE_SECONDS = 2;

  let error = $state('');
  let picking = $state(false);
  let preset = $state<CameraPreset>(CameraPreset.DollyIn);
  let amount = $state(String(PRESETS[CameraPreset.DollyIn].amount));
  let seconds = $state(String(DEFAULT_MOVE_SECONDS));
  let rackFrom = $state('');
  let rackTo = $state('');

  const worldClips = $derived(clipsOf(doc).filter((c) => c.space === Space.World && COMPONENTS[c.component].track === 'visual'));

  function commit(result: DocVerdict, summary: string) {
    if (!result.ok) {
      error = result.error;
      return;
    }
    error = '';
    onchange(result.doc, summary);
  }

  const shown = (key: CameraKey) => Math.round(cameraValueAt(doc, key, frame) * 1000) / 1000;

  function edit(key: CameraKey, value: number) {
    commit(cameraEditAt(doc, key, Math.min(CAMERA[key].max, Math.max(CAMERA[key].min, value)), frame), `Edited the camera ${CAMERA[key].label.toLowerCase()}`);
  }

  function editText(key: CameraKey, text: string) {
    const value = parseDecimal(text);
    if (value !== null) {
      edit(key, value);
    }
  }

  function keyState(key: CameraKey) {
    const track = doc.camera?.keyframes[key] ?? [];
    if (track.some((k) => k.frame === frame)) {
      return KEY_STATE.On;
    }
    return track.length ? KEY_STATE.Lane : KEY_STATE.None;
  }

  const faults = $derived(Object.fromEntries(expressionErrors(doc).filter((f) => f.clipId === CAMERA_LANE).map((f) => [f.key, f.error])));
  const DEFAULT_EXPRESSION = 'value';
  const expressionOf = (key: CameraKey) => doc.camera?.expressions[key];

  function toggleExpression(key: CameraKey) {
    const off = expressionOf(key) !== undefined;
    commit(setCameraExpression(doc, key, off ? null : DEFAULT_EXPRESSION), off ? `Removed the camera ${key} expression` : `Added a camera ${key} expression`);
  }

  function pickPreset(next: CameraPreset) {
    preset = next;
    amount = String(PRESETS[next].amount);
  }

  function applyMove() {
    const duration = parseDecimal(seconds);
    if (duration === null || duration <= 0) {
      error = 'the move needs a length in seconds';
      return;
    }
    const params = { start: frame, duration: Math.round(duration * FPS), amount: parseDecimal(amount) ?? undefined, from: rackFrom || undefined, to: rackTo || undefined };
    commit(applyPreset(doc, preset, params), `Camera ${PRESETS[preset].label.toLowerCase()}`);
  }

  function focusClip(clipId: string) {
    picking = false;
    commit(focusOn(doc, clipId, frame), 'Focused on a clip');
  }

  function label(clipId: string) {
    const clip = worldClips.find((c) => c.id === clipId);
    const text = (clip?.props as { text?: string } | undefined)?.text?.split('\n')[0];
    return clip ? `${COMPONENTS[clip.component].label}${text ? ` · ${text}` : ''}` : clipId;
  }
</script>

<div class="inspector" data-testid="camera-inspector">
  <header>
    <span class="kind">Camera</span>
    {#if doc.camera}
      <button type="button" class="link" onclick={() => commit(removeCamera(doc), 'Removed the camera')}>Remove</button>
    {/if}
  </header>

  {#if !doc.camera}
    <section>
      <p class="hint">A virtual camera puts the clips in a 3D world: give them depth, then move the camera for parallax, orbits and rack focus.</p>
      <button type="button" class="primary" data-testid="camera-add" onclick={() => commit(setCamera(doc, {}), 'Added a camera')}>Add a camera</button>
    </section>
  {:else}
    {@const camera = doc.camera}
    <section>
      <h4>Scene from above</h4>
      <SceneMap {doc} {frame} onpick={(id) => (picking ? focusClip(id) : undefined)} />
      {#if picking}<p class="hint">Click a layer on the map, or pick a clip below, to focus on it.</p>{/if}
    </section>

    {#snippet valueRow(key: CameraKey)}
      {@const spec = CAMERA[key]}
      <div class="row anim" data-camera-prop={key}>
        <span class="name">
          <button type="button" class="key {keyState(key)}" title="Keyframe at playhead" aria-label={`Keyframe camera ${key}`} aria-pressed={keyState(key) === KEY_STATE.On} onclick={() => commit(cameraKeyToggle(doc, key, frame), 'Toggled a camera keyframe')}>◆</button>
          <button type="button" class="expr-toggle" class:on={expressionOf(key) !== undefined} title="Expression" aria-label={`Expression camera ${key}`} aria-pressed={expressionOf(key) !== undefined} onclick={() => toggleExpression(key)}>=</button>
          {spec.label}
        </span>
        <div class="range">
          {#if DIALS.has(key)}<Dial value={shown(key)} label={spec.label} onchange={(v) => edit(key, v)} />{/if}
          <input type="range" min={spec.min} max={spec.max} step={spec.step} value={shown(key)} oninput={(e) => edit(key, Number(e.currentTarget.value))} />
          <input class="num" type="text" inputmode="decimal" aria-label={`Camera ${spec.label}`} value={String(shown(key))} onchange={(e) => editText(key, e.currentTarget.value)} />
        </div>
      </div>
      {#if expressionOf(key) !== undefined}
        <div class="expr" data-expression={key}>
          <textarea class="code" rows="2" spellcheck="false" aria-label={`Camera ${key} expression`} value={expressionOf(key)} onchange={(e) => commit(setCameraExpression(doc, key, e.currentTarget.value), `Edited the camera ${key} expression`)}></textarea>
          {#if faults[key]}<p class="expr-error" role="alert">{faults[key]}</p>{/if}
        </div>
      {/if}
    {/snippet}

    {#each GROUPS as group (group.title)}
      <section>
        <h4>{group.title}</h4>
        {#each group.keys as key (key)}{@render valueRow(key)}{/each}
      </section>
    {/each}

    <section data-testid="camera-focus">
      <h4>Depth of field</h4>
      <label class="check"><input type="checkbox" data-testid="camera-dof" checked={camera.dof} onchange={(e) => commit(setCamera(doc, { dof: e.currentTarget.checked }), 'Toggled depth of field')} />Blur what is out of focus</label>
      {@render valueRow('focusDistance')}
      <div class="row two">
        <button type="button" class="tool" class:on={picking} title="Focus on a clip" aria-pressed={picking} onclick={() => (picking = !picking)}><Pipette size={13} /> Focus on clip</button>
        <select aria-label="Focus on clip" value="" onchange={(e) => e.currentTarget.value && focusClip(e.currentTarget.value)}>
          <option value="">Pick a clip…</option>
          {#each worldClips as clip (clip.id)}<option value={clip.id}>{label(clip.id)} · {clip.depth}</option>{/each}
        </select>
      </div>
      {@render valueRow('aperture')}
    </section>

    <section data-testid="camera-presets">
      <h4>Moves</h4>
      <div class="row two">
        <label>
          Preset
          <select data-testid="camera-preset" value={preset} onchange={(e) => pickPreset(e.currentTarget.value as CameraPreset)}>
            {#each CAMERA_PRESETS as id (id)}<option value={id}>{PRESETS[id].label}</option>{/each}
          </select>
        </label>
        <label>Length (s)<input type="text" inputmode="decimal" bind:value={seconds} /></label>
      </div>
      {#if preset === CameraPreset.RackFocus}
        <div class="row two">
          <label>From<select bind:value={rackFrom}><option value="">…</option>{#each worldClips as clip (clip.id)}<option value={clip.id}>{label(clip.id)}</option>{/each}</select></label>
          <label>To<select bind:value={rackTo}><option value="">…</option>{#each worldClips as clip (clip.id)}<option value={clip.id}>{label(clip.id)}</option>{/each}</select></label>
        </div>
      {:else}
        <div class="row"><label for="camera-amount">Amount</label><input id="camera-amount" type="text" inputmode="decimal" bind:value={amount} /></div>
      {/if}
      <p class="hint">{PRESETS[preset].about}. Starts at the playhead.</p>
      <button type="button" class="primary" data-testid="camera-apply" onclick={applyMove}>Add move</button>
    </section>
  {/if}

  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
  .inspector {
    display: flex;
    flex-direction: column;
    font-size: 12px;
    overflow: auto;
    height: 100%;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 10px 12px;
    border-bottom: 1px solid var(--line);
  }

  .kind {
    font-weight: 600;
    font-size: 13px;
  }

  .link {
    color: var(--ink-soft);
    text-decoration: underline;
  }

  section {
    padding: 8px 12px 12px;
    border-bottom: 1px solid var(--line);
  }

  h4 {
    margin: 0 0 6px;
    font-family: 'Fragment Mono', ui-monospace, monospace;
    font-size: 10px;
    font-weight: 400;
    text-transform: uppercase;
    color: var(--ink-soft);
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-bottom: 8px;
  }

  .row.two {
    flex-direction: row;
    align-items: flex-end;
    gap: 8px;
  }

  .row.two label,
  .row.two select {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  input[type='text'],
  select {
    width: 100%;
    padding: 4px 6px;
    border: 1px solid var(--line);
    background: var(--paper);
    color: var(--ink);
    font: inherit;
  }

  .range {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .range input {
    flex: 1;
  }

  .anim .name {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .num {
    width: 56px !important;
    flex: none;
  }

  .expr-toggle {
    width: 16px;
    margin-right: 4px;
    font-family: 'Fragment Mono', monospace;
    font-size: 11px;
    color: var(--muted-foreground, #888);
  }

  .expr-toggle.on {
    color: #a855f7;
  }

  .expr {
    display: grid;
    gap: 4px;
    margin: 0 0 8px;
  }

  .expr .code {
    width: 100%;
    font-family: 'Fragment Mono', monospace;
    font-size: 11px;
    resize: vertical;
  }

  .expr-error {
    color: #e11d48;
    font-size: 11px;
    margin: 0;
  }

  .key {
    font-size: 10px;
    line-height: 1;
    width: 14px;
    color: var(--line);
  }

  .key.lane {
    color: var(--ink-soft);
  }

  .key.on {
    color: #a855f7;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  .tool {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px;
    border: 1px solid var(--line);
    white-space: nowrap;
  }

  .tool.on {
    border-color: #a855f7;
    color: #a855f7;
  }

  .primary {
    padding: 5px 10px;
    background: var(--ink);
    color: var(--paper);
  }

  .hint {
    margin: 0 0 8px;
    color: var(--ink-soft);
  }

  .error {
    margin: 8px 12px;
    color: var(--sh-destructive);
  }
</style>
