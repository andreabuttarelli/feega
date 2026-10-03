<script lang="ts">
  import { BRAND_COLORS, COMPONENTS, Control, type AssetKind } from '$lib/motion/components';
  import { FPS, TRANSITION_KINDS, type Edge } from '$lib/motion/design';
  import { resolveColor, type BrandTokens } from '$lib/motion/brand';
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { editAt, fieldGroups, keyAt, keyedField, parseDecimal, secondsLabel, toggleKey, valueAt, type Field } from '$lib/motion/inspector';
  import { setProps, setTiming, setTransform, setTransition, Side, type OpResult } from '$lib/motion/timeline';
  import { ANIMATABLE, Source, TRANSFORM, type AnimProp, type KeyValue } from '$lib/motion/keyframes';
  import Dial from './Dial.svelte';

  type Asset = { id: string; kind: AssetKind; label: string; previewUrl: string };

  let {
    doc,
    clip,
    tokens,
    assets,
    frame,
    onchange
  }: { doc: MotionDoc; clip: MotionClip; tokens: BrandTokens; assets: Asset[]; frame: number; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  const DIALS = new Set(['rotateX', 'rotateY', 'rotateZ', 'objectRotateX', 'objectRotateY', 'objectRotateZ', 'orbit']);
  const ANCHOR_STOPS = [0, 0.5, 1] as const;
  const KEY_STATE = { On: 'on', Lane: 'lane', None: 'none' } as const;

  let error = $state('');

  const groups = $derived(fieldGroups(clip.component));
  const spec = $derived(COMPONENTS[clip.component]);
  const transformProps = $derived(ANIMATABLE[clip.component].filter((p) => p.source === Source.Transform));
  const sceneProps = $derived(ANIMATABLE[clip.component].filter((p) => p.source === Source.Scene));
  const resolve = (v: string) => resolveColor(v, tokens);

  function commit(result: OpResult, summary: string) {
    if (!result.ok) {
      error = result.error;
      return;
    }
    error = '';
    onchange(result.doc, summary);
  }

  function setProp(field: Field, value: unknown) {
    if (keyedField(clip.component, field.key)) {
      animate(field.key, value as KeyValue);
      return;
    }
    commit(setProps(doc, clip.id, { [field.key]: value }), `Edited ${field.label.toLowerCase()}`);
  }

  function setSeconds(key: 'from' | 'durationInFrames', text: string) {
    const seconds = parseDecimal(text);
    if (seconds === null) {
      return;
    }
    commit(setTiming(doc, clip.id, { [key]: Math.round(seconds * FPS) }), 'Changed timing');
  }

  function setEdge(side: Side, edge: Partial<Edge>) {
    const current = side === Side.In ? clip.transitionIn : clip.transitionOut;
    commit(setTransition(doc, clip.id, side, { ...current, ...edge }), 'Changed transition');
  }

  function setEdgeSeconds(side: Side, text: string) {
    const seconds = parseDecimal(text);
    if (seconds === null) {
      return;
    }
    setEdge(side, { durationInFrames: Math.round(seconds * FPS) });
  }

  function animate(key: string, value: KeyValue) {
    commit(editAt(doc, clip, key, value, frame), `Edited ${key}`);
  }

  function animateText(prop: AnimProp, text: string) {
    const parsed = parseDecimal(text);
    if (parsed !== null) {
      animate(prop.key, Math.min(prop.max, Math.max(prop.min, parsed)));
    }
  }

  function toggle(key: string) {
    commit(toggleKey(doc, clip, key, frame, resolve), 'Toggled a keyframe');
  }

  function keyState(key: string) {
    if (keyAt(clip, key, frame)) {
      return KEY_STATE.On;
    }
    return clip.keyframes[key]?.length ? KEY_STATE.Lane : KEY_STATE.None;
  }

  const shown = (key: string) => valueAt(clip, key, frame, resolve);
  const numberShown = (prop: AnimProp) => Math.round(Number(shown(prop.key)) * 1000) / 1000;
  const value = (field: Field) => (keyedField(clip.component, field.key) ? shown(field.key) : (clip.props as Record<string, unknown>)[field.key]);
  const isHex = (v: unknown) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
</script>

<div class="inspector" data-testid="motion-inspector">
  <header>
    <span class="kind">{spec.label}</span>
    <span class="id">{clip.id}</span>
  </header>

  <section>
    <h4>Timing</h4>
    <div class="row two">
      <label>Start (s)<input type="text" inputmode="decimal" value={secondsLabel(clip.from)} onchange={(e) => setSeconds('from', e.currentTarget.value)} /></label>
      <label>Length (s)<input type="text" inputmode="decimal" value={secondsLabel(clip.durationInFrames)} onchange={(e) => setSeconds('durationInFrames', e.currentTarget.value)} /></label>
    </div>
    {#each [Side.In, Side.Out] as side (side)}
      {@const edge = side === Side.In ? clip.transitionIn : clip.transitionOut}
      <div class="row two">
        <label>
          Transition {side}
          <select value={edge.kind} onchange={(e) => setEdge(side, { kind: e.currentTarget.value as Edge['kind'], durationInFrames: edge.durationInFrames || 12 })}>
            {#each TRANSITION_KINDS as kind (kind)}<option value={kind}>{kind}</option>{/each}
          </select>
        </label>
        <label>Duration (s)<input type="text" inputmode="decimal" value={secondsLabel(edge.durationInFrames)} onchange={(e) => setEdgeSeconds(side, e.currentTarget.value)} /></label>
      </div>
    {/each}
  </section>

  {#snippet diamond(key: string)}
    <button type="button" class="key {keyState(key)}" title="Keyframe at playhead" aria-label={`Keyframe ${key}`} aria-pressed={keyState(key) === KEY_STATE.On} onclick={() => toggle(key)}>◆</button>
  {/snippet}

  {#snippet animRow(prop: AnimProp)}
    <div class="row anim" data-prop={prop.key}>
      <span class="name">{@render diamond(prop.key)}{prop.label}</span>
      <div class="range">
        {#if DIALS.has(prop.key)}<Dial value={numberShown(prop)} label={prop.label} onchange={(v) => animate(prop.key, v)} />{/if}
        <input type="range" min={prop.min} max={prop.max} step={prop.step} value={numberShown(prop)} oninput={(e) => animate(prop.key, Number(e.currentTarget.value))} />
        <input class="num" type="text" inputmode="decimal" aria-label={prop.label} value={String(numberShown(prop))} onchange={(e) => animateText(prop, e.currentTarget.value)} />
      </div>
    </div>
  {/snippet}

  {#if transformProps.length}
    <section data-testid="transform-section">
      <h4>3D transform</h4>
      {#each transformProps as prop (prop.key)}{@render animRow(prop)}{/each}
      <div class="row anim">
        <span class="name">Anchor</span>
        <div class="anchor" role="group" aria-label="Anchor">
          {#each ANCHOR_STOPS as ay (ay)}
            {#each ANCHOR_STOPS as ax (ax)}
              {@const on = (clip.transform.anchorX ?? TRANSFORM.anchorX.fallback) === ax && (clip.transform.anchorY ?? TRANSFORM.anchorY.fallback) === ay}
              <button type="button" class:on aria-label={`Anchor ${ax} ${ay}`} onclick={() => commit(setTransform(doc, clip.id, { anchorX: ax, anchorY: ay }), 'Moved the anchor')}></button>
            {/each}
          {/each}
        </div>
      </div>
    </section>
  {/if}

  {#if sceneProps.length}
    <section>
      <h4>3D scene</h4>
      {#each sceneProps as prop (prop.key)}{@render animRow(prop)}{/each}
    </section>
  {/if}

  {#each groups as { group, fields } (group)}
    <section>
      <h4>{group}</h4>
      {#each fields as field (field.key)}
        <div class="row">
          <label for={`f-${field.key}`}>{#if keyedField(clip.component, field.key)}{@render diamond(field.key)}{/if}{field.label}</label>
          {#if field.control === Control.Text}
            <input id={`f-${field.key}`} type="text" value={String(value(field) ?? '')} onchange={(e) => setProp(field, e.currentTarget.value)} />
          {:else if field.control === Control.Textarea}
            <textarea id={`f-${field.key}`} rows="3" value={String(value(field) ?? '')} onchange={(e) => setProp(field, e.currentTarget.value)}></textarea>
          {:else if field.control === Control.Range}
            <div class="range">
              <input id={`f-${field.key}`} type="range" min={field.min} max={field.max} step={field.step} value={Number(value(field))} oninput={(e) => setProp(field, Number(e.currentTarget.value))} />
              <output>{Number(value(field)).toFixed(field.step && field.step < 1 ? 2 : 0)}</output>
            </div>
          {:else if field.control === Control.Select}
            <select id={`f-${field.key}`} value={String(value(field))} onchange={(e) => setProp(field, e.currentTarget.value)}>
              {#each field.options ?? [] as option (option)}<option value={option}>{option}</option>{/each}
            </select>
          {:else if field.control === Control.Toggle}
            <input id={`f-${field.key}`} type="checkbox" checked={value(field) === true} onchange={(e) => setProp(field, e.currentTarget.checked)} />
          {:else if field.control === Control.Color}
            <div class="swatches">
              {#each BRAND_COLORS as token (token)}
                <button type="button" class="swatch" class:on={value(field) === token} title={token} aria-label={token} style={`background: ${resolveColor(token, tokens)};`} onclick={() => setProp(field, token)}></button>
              {/each}
              <input id={`f-${field.key}`} type="color" value={isHex(value(field)) ? String(value(field)) : resolveColor(value(field), tokens)} onchange={(e) => setProp(field, e.currentTarget.value)} />
            </div>
          {:else if field.control === Control.Asset}
            <div class="assets">
              <button type="button" class="asset none" class:on={!value(field)} onclick={() => setProp(field, null)}>None</button>
              {#each assets.filter((a) => a.kind === field.assetKind) as asset (asset.id)}
                <button type="button" class="asset" class:on={value(field) === asset.id} title={asset.label} onclick={() => setProp(field, asset.id)}>
                  {#if asset.kind === 'image'}<img src={asset.previewUrl} alt="" />{:else}<span>{asset.label}</span>{/if}
                </button>
              {:else}
                <span class="empty">No {field.assetKind} assets on this canvas yet.</span>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </section>
  {/each}

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

  .id {
    font-family: 'Fragment Mono', ui-monospace, monospace;
    color: var(--ink-soft);
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
    gap: 8px;
  }

  .row.two label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  input[type='text'],
  input[type='number'],
  textarea,
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

  output {
    width: 40px;
    text-align: right;
    font-family: 'Fragment Mono', ui-monospace, monospace;
  }

  .swatches {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .swatch {
    width: 20px;
    height: 20px;
    border: 1px solid var(--line);
  }

  .swatch.on {
    outline: 2px solid #a855f7;
    outline-offset: 1px;
  }

  input[type='color'] {
    width: 28px;
    height: 22px;
    padding: 0;
    border: 1px solid var(--line);
    background: none;
  }

  .assets {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }

  .asset {
    aspect-ratio: 1;
    border: 1px solid var(--line);
    background: var(--paper-2);
    overflow: hidden;
    font-size: 9px;
    padding: 2px;
    word-break: break-all;
  }

  .asset img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .asset.on {
    outline: 2px solid #a855f7;
    outline-offset: 1px;
  }

  .empty {
    grid-column: 1 / -1;
    color: var(--ink-soft);
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

  .anchor {
    display: grid;
    grid-template-columns: repeat(3, 14px);
    gap: 3px;
  }

  .anchor button {
    width: 14px;
    height: 14px;
    border: 1px solid var(--line);
    background: var(--paper);
  }

  .anchor button.on {
    background: #a855f7;
    border-color: #a855f7;
  }

  .error {
    margin: 8px 12px;
    color: var(--sh-destructive);
  }
</style>
