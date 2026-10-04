<script lang="ts">
  import { BRAND_COLORS, COMPONENTS, Control, type AssetKind } from '$lib/motion/components';
  import { FPS, TRANSITION_KINDS, type Edge } from '$lib/motion/design';
  import { resolveColor, type BrandTokens } from '$lib/motion/brand';
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { InspectorTab, clipFieldGroups, editAt, keyAt, keyedField, parseDecimal, secondsLabel, toggleKey, valueAt, type Field } from '$lib/motion/inspector';
  import { setMask, setProps, setTiming, setTrackMatte, setTransform, setTransition, Side, type OpResult } from '$lib/motion/timeline';
  import { MASK_KINDS, MASK_KIND_IDS, MATTES, MaskKind, Matte, Needs, newMask, type Mask } from '$lib/motion/mask';
  import { ANIMATABLE, Source, TRANSFORM, type AnimProp, type KeyValue } from '$lib/motion/keyframes';
  import Dial from './Dial.svelte';
  import CodeEditor from './CodeEditor.svelte';
  import { withParams } from '$lib/motion/custom/params';
  import type { CustomSource } from '$lib/motion/custom/component';


  type Asset = { id: string; kind: AssetKind; label: string; previewUrl: string };

  let {
    doc,
    clip,
    tokens,
    assets,
    frame,
    previousSource = () => null,
    composeHref = null,
    tab = $bindable<InspectorTab>(InspectorTab.Properties),
    onchange
  }: {
    doc: MotionDoc;
    clip: MotionClip;
    tokens: BrandTokens;
    assets: Asset[];
    frame: number;
    previousSource?: (name: string) => CustomSource | null;
    composeHref?: string | null;
    tab?: InspectorTab;
    onchange: (doc: MotionDoc, summary: string) => void;
  } = $props();

  const DIALS = new Set(['rotateX', 'rotateY', 'rotateZ', 'objectRotateX', 'objectRotateY', 'objectRotateZ', 'orbit', 'maskRotation']);
  const ANCHOR_STOPS = [0, 0.5, 1] as const;
  const KEY_STATE = { On: 'on', Lane: 'lane', None: 'none' } as const;

  let error = $state('');

  const groups = $derived(clipFieldGroups(doc, clip));
  const animated = $derived(withParams(doc, clip));
  const customName = $derived(clip.component === 'Custom' ? String(clip.props.name) : null);
  const spec = $derived(COMPONENTS[clip.component]);
  const transformProps = $derived(ANIMATABLE[clip.component].filter((p) => p.source === Source.Transform));
  const sceneProps = $derived(ANIMATABLE[clip.component].filter((p) => p.source === Source.Scene));
  const maskProps = $derived(ANIMATABLE[clip.component].filter((p) => p.source === Source.Mask));
  const NO_MASK = 'none';
  const pictures = $derived(assets.filter((a) => a.kind === 'image'));
  const resolve = (v: string) => resolveColor(v, tokens);
  const managedSummary = (v: unknown) => `${Array.isArray(v) ? v.length : Object.keys(v ?? {}).length} set`;

  function commit(result: OpResult, summary: string) {
    if (!result.ok) {
      error = result.error;
      return;
    }
    error = '';
    onchange(result.doc, summary);
  }

  function setProp(field: Field, value: unknown) {
    if (keyedField(clip.component, field.key, animated.params)) {
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

  function pickMask(kind: string) {
    if (kind === NO_MASK) {
      commit(setMask(doc, clip.id, null), 'Removed the mask');
      return;
    }
    const picture = (clip.props as { assetId?: string | null }).assetId;
    const asset = pictures.find((a) => a.id === picture)?.id ?? pictures[0]?.id ?? null;
    commit(setMask(doc, clip.id, newMask(kind as MaskKind, asset)), 'Added a mask');
  }

  function editMask(mask: Mask, patch: Partial<Mask>) {
    commit(setMask(doc, clip.id, { ...mask, ...patch }), 'Edited the mask');
  }

  const shown = (key: string) => valueAt(animated, key, frame, resolve);
  const numberShown = (prop: AnimProp) => Math.round(Number(shown(prop.key)) * 1000) / 1000;
  const value = (field: Field) => (keyedField(clip.component, field.key, animated.params) ? shown(field.key) : (clip.props as Record<string, unknown>)[field.key]);
  const isHex = (v: unknown) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
</script>

<div class="inspector" data-testid="motion-inspector">
  <header>
    <span class="kind">{customName ?? spec.label}</span>
    <span class="id">{clip.id}</span>
  </header>

  {#if customName}
    <div class="tabs" role="tablist">
      <button type="button" role="tab" aria-selected={tab === InspectorTab.Properties} class:on={tab === InspectorTab.Properties} onclick={() => (tab = InspectorTab.Properties)}>Properties</button>
      <button type="button" role="tab" aria-selected={tab === InspectorTab.Code} class:on={tab === InspectorTab.Code} onclick={() => (tab = InspectorTab.Code)} data-testid="code-tab-open">Code</button>
    </div>
  {/if}

  {#if customName && tab === InspectorTab.Code}
    <CodeEditor {doc} name={customName} previous={previousSource(customName)} {onchange} />
  {:else}

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

  {#if maskProps.length}
    <section data-testid="mask-section">
      <h4>Mask</h4>
      <div class="row two">
        <label>
          Shape
          <select data-testid="mask-kind" value={clip.mask?.kind ?? NO_MASK} onchange={(e) => pickMask(e.currentTarget.value)}>
            <option value={NO_MASK}>None</option>
            {#each MASK_KIND_IDS as kind (kind)}<option value={kind}>{MASK_KINDS[kind].label}</option>{/each}
          </select>
        </label>
        <label>
          Track matte
          <select data-testid="track-matte" value={clip.matte} onchange={(e) => commit(setTrackMatte(doc, clip.id, e.currentTarget.value as Matte), 'Changed the track matte')}>
            {#each MATTES as matte (matte)}<option value={matte}>{matte === Matte.None ? 'None' : `${matte} of the clip above`}</option>{/each}
          </select>
        </label>
      </div>
      {#if clip.mask}
        {@const mask = clip.mask}
        <label class="check"><input type="checkbox" checked={mask.invert} onchange={(e) => editMask(mask, { invert: e.currentTarget.checked })} />Invert</label>
        {#if MASK_KINDS[mask.kind].needs === Needs.Text}
          <div class="row"><label for="mask-text">Text</label><input id="mask-text" type="text" value={mask.text} onchange={(e) => editMask(mask, { text: e.currentTarget.value })} /></div>
        {:else if MASK_KINDS[mask.kind].needs === Needs.Asset}
          <div class="assets">
            {#each pictures as asset (asset.id)}
              <button type="button" class="asset" class:on={mask.assetId === asset.id} title={asset.label} onclick={() => editMask(mask, { assetId: asset.id })}><img src={asset.previewUrl} alt="" /></button>
            {:else}
              <span class="empty">No image assets on this canvas yet.</span>
            {/each}
          </div>
        {:else if MASK_KINDS[mask.kind].needs === Needs.Points}
          <p class="hint">Drag the points on the preview.</p>
        {/if}
        {#each maskProps as prop (prop.key)}{@render animRow(prop)}{/each}
      {/if}
    </section>
  {/if}

  {#each groups as { group, fields } (group)}
    <section>
      <h4>{group}</h4>
      {#each fields as field (field.key)}
        <div class="row">
          <label for={`f-${field.key}`}>{#if keyedField(clip.component, field.key, animated.params)}{@render diamond(field.key)}{/if}{field.label}</label>
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
          {:else if field.control === Control.Managed}
            <span class="managed">{managedSummary(value(field))}{#if composeHref} · <a href={composeHref}>Edit in Compositions</a>{/if}</span>
          {/if}
        </div>
      {/each}
    </section>
  {/each}

  {/if}

  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
  .managed {
    color: var(--ink-soft);
  }

  .managed a {
    color: var(--ink);
    text-decoration: underline;
  }

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

  .tabs {
    display: flex;
    border-bottom: 1px solid var(--line);
  }

  .tabs button {
    flex: 1;
    padding: 6px 0;
    font-size: 12px;
    color: var(--ink-soft);
  }

  .tabs button.on {
    color: var(--ink);
    box-shadow: inset 0 -2px 0 var(--ink);
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

  .check {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
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
