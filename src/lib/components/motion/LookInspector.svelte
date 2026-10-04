<script lang="ts">
  import type { DocVerdict, MotionDoc } from '$lib/motion/doc';
  import { ENVIRONMENT, ENV_PRESETS, LIGHT, LIGHT_KINDS, LightKind, MAX_LIGHTS, type Light } from '$lib/motion/look';
  import { removeLight, removeLook, setLight, setLook } from '$lib/motion/look-ops';

  let { doc, onchange }: { doc: MotionDoc; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  const POSITION = ['x', 'y', 'z'] as const;
  let error = $state('');

  function commit(result: DocVerdict, summary: string) {
    if (!result.ok) {
      error = result.error;
      return;
    }
    error = '';
    onchange(result.doc, summary);
  }

  function nextId(): string {
    const taken = new Set(doc.look?.lights.map((l) => l.id));
    let n = 1;
    while (taken.has(`light${n}`)) {
      n += 1;
    }
    return `light${n}`;
  }

  const editLight = (light: Light, patch: Parameters<typeof setLight>[2]) => commit(setLight(doc, light.id, patch), `Edited light ${light.id}`);
</script>

<div class="look" data-testid="look-inspector">
  <header>
    <span class="kind">3D look</span>
    {#if doc.look}
      <button type="button" class="link" onclick={() => commit(removeLook(doc), 'Removed the 3D look')}>Remove</button>
    {/if}
  </header>

  {#if !doc.look}
    <section>
      <p class="hint">Environment light, soft shadows and your own lights for every 3D clip.</p>
      <button type="button" class="primary" data-testid="look-add" onclick={() => commit(setLook(doc, {}), 'Added a 3D look')}>Add a 3D look</button>
    </section>
  {:else}
    {@const look = doc.look}
    <section>
      <h4>Environment</h4>
      <label class="row">
        Preset
        <select value={look.environment.preset} onchange={(e) => commit(setLook(doc, { environment: { preset: e.currentTarget.value as (typeof ENV_PRESETS)[number] } }), 'Changed the environment')}>
          {#each ENV_PRESETS as preset (preset)}<option value={preset}>{preset}</option>{/each}
        </select>
      </label>
      <label class="row">
        Intensity
        <input type="range" min={ENVIRONMENT.intensity.min} max={ENVIRONMENT.intensity.max} step="0.05" value={look.environment.intensity} oninput={(e) => commit(setLook(doc, { environment: { intensity: Number(e.currentTarget.value) } }), 'Environment intensity')} />
      </label>
      <label class="row">
        Rotation
        <input type="range" min={ENVIRONMENT.rotation.min} max={ENVIRONMENT.rotation.max} step="1" value={look.environment.rotation} oninput={(e) => commit(setLook(doc, { environment: { rotation: Number(e.currentTarget.value) } }), 'Environment rotation')} />
      </label>
      <label class="check"><input type="checkbox" checked={look.softShadows} onchange={(e) => commit(setLook(doc, { softShadows: e.currentTarget.checked }), 'Soft shadows')} /> Soft shadows</label>
      <label class="check"><input type="checkbox" checked={look.contactShadow} onchange={(e) => commit(setLook(doc, { contactShadow: e.currentTarget.checked }), 'Contact shadow')} /> Contact shadow</label>
    </section>

    <section>
      <h4>Lights</h4>
      {#each look.lights as light (light.id)}
        <div class="light" data-light={light.id}>
          <div class="head">
            <select value={light.kind} aria-label={`Kind of ${light.id}`} onchange={(e) => editLight(light, { kind: e.currentTarget.value as LightKind })}>
              {#each LIGHT_KINDS as kind (kind)}<option value={kind}>{kind}</option>{/each}
            </select>
            <input type="color" value={light.color} aria-label={`Colour of ${light.id}`} onchange={(e) => editLight(light, { color: e.currentTarget.value })} />
            <button type="button" class="link" onclick={() => commit(removeLight(doc, light.id), `Removed light ${light.id}`)}>Remove</button>
          </div>
          <label class="row">
            Intensity
            <input type="range" min={LIGHT.intensity.min} max={LIGHT.intensity.max} step="0.1" value={light.intensity} oninput={(e) => editLight(light, { intensity: Number(e.currentTarget.value) })} />
          </label>
          {#each POSITION as axis (axis)}
            <label class="row">
              {axis.toUpperCase()}
              <input type="range" min={LIGHT[axis].min} max={LIGHT[axis].max} step="0.1" value={light[axis]} oninput={(e) => editLight(light, { [axis]: Number(e.currentTarget.value) })} />
            </label>
          {/each}
        </div>
      {/each}
      <button type="button" data-testid="look-add-light" onclick={() => commit(setLight(doc, nextId(), { kind: LightKind.Directional }), 'Added a light')} disabled={look.lights.length >= MAX_LIGHTS}>Add a light</button>
    </section>
  {/if}

  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
  .look {
    display: flex;
    flex-direction: column;
    font-size: var(--ui-text-sm);
    border-top: 1px solid var(--ui-line);
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 10px 12px;
    border-bottom: 1px solid var(--ui-line);
  }

  .kind {
    font-weight: 600;
    font-size: var(--ui-text-md);
  }

  section {
    padding: 8px 12px 12px;
    border-bottom: 1px solid var(--ui-line);
  }

  h4 {
    margin: 0 0 6px;
    font-family: var(--ui-mono);
    font-size: 10px;
    font-weight: 400;
    text-transform: uppercase;
    color: var(--ui-ink-2);
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-bottom: 8px;
    color: var(--ui-ink-2);
  }

  .check {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 6px;
  }

  .light {
    padding: 8px 0;
    border-bottom: 1px solid var(--ui-line);
    margin-bottom: 8px;
  }

  .head {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 6px;
  }

  select {
    flex: 1;
    padding: 4px 6px;
    border: 1px solid var(--ui-line-strong);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font: inherit;
  }

  input[type='color'] {
    width: 28px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--ui-line-strong);
  }

  button {
    padding: 5px 10px;
    border: 1px solid var(--ui-line-strong);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font: inherit;
  }

  button.primary {
    background: var(--ui-accent);
    border-color: var(--ui-accent);
    color: #fff;
  }

  .link {
    border: none;
    padding: 0;
    color: var(--ui-ink-2);
    text-decoration: underline;
  }

  .hint {
    color: var(--ui-ink-2);
    margin: 0 0 8px;
  }

  .error {
    color: #c62828;
    padding: 8px 12px;
  }
</style>
