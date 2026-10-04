<script lang="ts">
  import { BRAND_COLORS, COMPONENTS, Control, TrackKind, type AssetKind } from '$lib/motion/components';
  import { DEPTH, Space } from '$lib/motion/camera';
  import { setClipDepth } from '$lib/motion/camera-ops';
  import { ParentOpacity, parentChoices } from '$lib/motion/parent';
  import { setParent, setParentOpacity } from '$lib/motion/parent-ops';
  import { findClip } from '$lib/motion/doc';
  import { TRANSITION_KINDS, type Edge } from '$lib/motion/design';
  import { resolveColor, type BrandTokens } from '$lib/motion/brand';
  import type { MotionClip, MotionDoc } from '$lib/motion/doc';
  import { InspectorTab, clipFieldGroups, editAt, keyAt, keyedField, parseDecimal, secondsLabel, toggleKey, valueAt, type Field } from '$lib/motion/inspector';
  import { setMask, setProps, setTiming, setTrackMatte, setTransform, setTransition, Side, type OpResult } from '$lib/motion/timeline';
  import { MASK_KINDS, MASK_KIND_IDS, MATTES, MaskKind, Matte, Needs, newMask, type Mask } from '$lib/motion/mask';
  import { ANIMATABLE, Source, TRANSFORM, ValueKind, type AnimProp, type KeyValue } from '$lib/motion/keyframes';
  import Dial from './Dial.svelte';
  import CodeEditor from './CodeEditor.svelte';
  import FontPicker from './FontPicker.svelte';
  import { registerFont, setFont } from '$lib/motion/fonts/ops';
  import type { CatalogueFont } from '$lib/motion/fonts/model';
  import { withParams } from '$lib/motion/custom/params';
  import type { CustomSource } from '$lib/motion/custom/component';
  import { setExpression } from '$lib/motion/expression/ops';
  import { EFFECTS, EFFECT_KINDS, type EffectKind } from '$lib/motion/effects/registry';
  import { addEffect, removeEffect, setEffect } from '$lib/motion/effects/ops';
  import { effectKey } from '$lib/motion/effects/model';
  import { SELECTOR_SHAPES, animatorKey, type SelectorShape } from '$lib/motion/text-animators/model';
  import { TEXT_COMPONENTS, TEXT_PRESETS, applyPreset as applyTextPreset, removeAnimator, setAnimator, type TextPreset } from '$lib/motion/text-animators/ops';
  import { BLEND_MODES, type BlendMode } from '$lib/motion/blend';
  import { setBlendMode } from '$lib/motion/blend-ops';
  import { expressionErrors, expressionValue } from '$lib/motion/expression/bake';


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
    onchange,
    onuploadfont
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
    onuploadfont?: (file: File) => Promise<string | null>;
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

  function pickFont(field: Field, family: string, catalogue: CatalogueFont[]) {
    if (clip.component !== 'Custom') {
      commit(setFont(doc, clip.id, { family }, catalogue), `Set the font to ${family}`);
      return;
    }
    const registered = registerFont(doc, family, catalogue);
    commit(registered.ok ? setProps(registered.doc, clip.id, { [field.key]: family }) : registered, `Set ${field.label.toLowerCase()} to ${family}`);
  }

  function setSeconds(key: 'from' | 'durationInFrames', text: string) {
    const seconds = parseDecimal(text);
    if (seconds === null) {
      return;
    }
    commit(setTiming(doc, clip.id, { [key]: Math.round(seconds * doc.fps) }), 'Changed timing');
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
    setEdge(side, { durationInFrames: Math.round(seconds * doc.fps) });
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

  const NO_PARENT = '';

  function clipName(id: string): string {
    const other = findClip(doc, id)?.clip;
    return other ? `${COMPONENTS[other.component].label} · ${id}` : id;
  }

  function setDepthText(text: string) {
    const depth = parseDecimal(text);
    if (depth !== null) {
      commit(setClipDepth(doc, clip.id, { depth }), 'Changed depth');
    }
  }

  const faults = $derived(Object.fromEntries(expressionErrors(doc).filter((f) => f.clipId === clip.id).map((f) => [f.key, f.error])));
  const DEFAULT_EXPRESSION = 'value';
  const BLEND_LABEL = Object.fromEntries(BLEND_MODES.map((m) => [m, m.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')])) as Record<BlendMode, string>;

  function toggleExpression(key: string) {
    const off = clip.expressions[key] !== undefined;
    commit(setExpression(doc, clip.id, key, off ? null : DEFAULT_EXPRESSION), off ? `Removed the ${key} expression` : `Added a ${key} expression`);
  }

  function editExpression(key: string, source: string) {
    commit(setExpression(doc, clip.id, key, source), `Edited the ${key} expression`);
  }

  function expressionNow(key: string): string {
    try {
      return String(Math.round(expressionValue(doc, clip.id, key, clip.from + Math.max(0, frame - clip.from)) * 1000) / 1000);
    } catch {
      return '—';
    }
  }

  let draggedEffect = $state<string | null>(null);
  const effectParams = (effectId: string) => animated.params.filter((p) => p.source === Source.Effect && p.key.startsWith(`${effectKey(effectId, '')}`));

  const animatorRows = (id: string) => animated.params.filter((p) => p.source === Source.Animator && p.key.startsWith(animatorKey(id, '')));
  const TEXT_PRESET_SECONDS = 1;

  function addTextPreset(select: HTMLSelectElement) {
    const preset = select.value as TextPreset;
    select.value = '';
    if (preset) {
      commit(applyTextPreset(doc, clip.id, preset, { start: Math.max(0, frame - clip.from), duration: TEXT_PRESET_SECONDS * FPS }, crypto.randomUUID().slice(0, 8)), `Added ${preset}`);
    }
  }

  function addEffectOf(select: HTMLSelectElement) {
    const kind = select.value as EffectKind;
    select.value = '';
    if (kind) {
      commit(addEffect(doc, clip.id, kind, crypto.randomUUID().slice(0, 8)), `Added ${EFFECTS[kind].label.toLowerCase()}`);
    }
  }

  function dropEffect(index: number) {
    if (draggedEffect) {
      commit(setEffect(doc, clip.id, draggedEffect, { index }), 'Reordered effects');
    }
    draggedEffect = null;
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
      <label>Start (s)<input type="text" inputmode="decimal" value={secondsLabel(clip.from, doc.fps)} onchange={(e) => setSeconds('from', e.currentTarget.value)} /></label>
      <label>Length (s)<input type="text" inputmode="decimal" value={secondsLabel(clip.durationInFrames, doc.fps)} onchange={(e) => setSeconds('durationInFrames', e.currentTarget.value)} /></label>
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
        <label>Duration (s)<input type="text" inputmode="decimal" value={secondsLabel(edge.durationInFrames, doc.fps)} onchange={(e) => setEdgeSeconds(side, e.currentTarget.value)} /></label>
      </div>
    {/each}
  </section>

  {#snippet diamond(key: string)}
    <button type="button" class="key {keyState(key)}" title="Keyframe at playhead" aria-label={`Keyframe ${key}`} aria-pressed={keyState(key) === KEY_STATE.On} onclick={() => toggle(key)}>◆</button>
  {/snippet}

  {#snippet exprToggle(key: string)}
    <button type="button" class="expr-toggle" class:on={clip.expressions[key] !== undefined} title="Expression" aria-label={`Expression ${key}`} aria-pressed={clip.expressions[key] !== undefined} onclick={() => toggleExpression(key)}>=</button>
  {/snippet}

  {#snippet exprEditor(key: string)}
    {#if clip.expressions[key] !== undefined}
      <div class="expr" data-expression={key}>
        <textarea class="code" rows="2" spellcheck="false" aria-label={`${key} expression`} value={clip.expressions[key]} onchange={(e) => editExpression(key, e.currentTarget.value)}></textarea>
        {#if faults[key]}<p class="expr-error" role="alert">{faults[key]}</p>{:else}<output class="expr-now">= {expressionNow(key)}</output>{/if}
      </div>
    {/if}
  {/snippet}

  {#snippet animRow(prop: AnimProp)}
    <div class="row anim" data-prop={prop.key}>
      <span class="name">{@render diamond(prop.key)}{@render exprToggle(prop.key)}{prop.label}</span>
      <div class="range">
        {#if DIALS.has(prop.key)}<Dial value={numberShown(prop)} label={prop.label} onchange={(v) => animate(prop.key, v)} />{/if}
        <input type="range" min={prop.min} max={prop.max} step={prop.step} value={numberShown(prop)} oninput={(e) => animate(prop.key, Number(e.currentTarget.value))} />
        <input class="num" type="text" inputmode="decimal" aria-label={prop.label} value={String(numberShown(prop))} onchange={(e) => animateText(prop, e.currentTarget.value)} />
      </div>
    </div>
    {@render exprEditor(prop.key)}
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

  {#if TEXT_COMPONENTS.has(clip.component)}
    <section data-testid="text-animators-section">
      <h4>Text animators</h4>
      {#each clip.animators as animator, i (animator.id)}
        <div class="effect" data-animator={animator.id}>
          <div class="effect-head">
            <span class="effect-name">Animator {i + 1} · {animator.unit}</span>
            <select aria-label="Selector shape" value={animator.shape} onchange={(e) => commit(setAnimator(doc, clip.id, animator.id, { shape: e.currentTarget.value as SelectorShape }), 'Changed a text animator')}>
              {#each SELECTOR_SHAPES as shape (shape)}<option value={shape}>{shape}</option>{/each}
            </select>
            <button type="button" aria-label="Shuffle order" title="Randomise the order (seeded)" onclick={() => commit(setAnimator(doc, clip.id, animator.id, { seed: animator.seed === null ? 1 : null }), 'Changed a text animator')}>{animator.seed === null ? '↯' : '→'}</button>
            <button type="button" aria-label={`Remove animator ${i + 1}`} onclick={() => commit(removeAnimator(doc, clip.id, animator.id), 'Removed a text animator')}>×</button>
          </div>
          {#each animatorRows(animator.id) as prop (prop.key)}
            {#if prop.kind === ValueKind.Number}{@render animRow({ ...prop, label: prop.label.split(' · ')[1] })}{/if}
          {/each}
        </div>
      {/each}
      <div class="row">
        <select aria-label="Add text preset" data-testid="add-text-preset" value="" onchange={(e) => addTextPreset(e.currentTarget)}>
          <option value="">Add text animation…</option>
          {#each TEXT_PRESETS as preset (preset)}<option value={preset}>{preset}</option>{/each}
        </select>
      </div>
    </section>
  {/if}

  {#if spec.track === TrackKind.Visual && clip.component !== 'Null'}
    <section data-testid="effects-section">
      <h4>Effects</h4>
      {#each clip.effects as effect, i (effect.id)}
        <div class="effect" class:off={!effect.enabled} role="listitem" draggable="true" data-effect={effect.id} ondragstart={() => (draggedEffect = effect.id)} ondragover={(e) => e.preventDefault()} ondrop={() => dropEffect(i)}>
          <div class="effect-head">
            <span class="grip" aria-hidden="true">⋮⋮</span>
            <label class="effect-name"><input type="checkbox" checked={effect.enabled} aria-label={`Enable ${EFFECTS[effect.kind].label}`} onchange={(e) => commit(setEffect(doc, clip.id, effect.id, { enabled: e.currentTarget.checked }), 'Toggled an effect')} />{EFFECTS[effect.kind].label}</label>
            <button type="button" aria-label="Move effect up" disabled={i === 0} onclick={() => commit(setEffect(doc, clip.id, effect.id, { index: i - 1 }), 'Reordered effects')}>↑</button>
            <button type="button" aria-label="Move effect down" disabled={i === clip.effects.length - 1} onclick={() => commit(setEffect(doc, clip.id, effect.id, { index: i + 1 }), 'Reordered effects')}>↓</button>
            <button type="button" aria-label={`Remove ${EFFECTS[effect.kind].label}`} onclick={() => commit(removeEffect(doc, clip.id, effect.id), 'Removed an effect')}>×</button>
          </div>
          {#each effectParams(effect.id) as prop (prop.key)}
            {#if prop.kind === ValueKind.Color}
              <div class="row anim" data-prop={prop.key}>
                <span class="name">{@render diamond(prop.key)}{prop.label.split(' · ')[1]}</span>
                <input type="color" aria-label={prop.label} value={resolve(String(shown(prop.key)))} onchange={(e) => animate(prop.key, e.currentTarget.value)} />
              </div>
            {:else}
              {@render animRow({ ...prop, label: prop.label.split(' · ')[1] })}
            {/if}
          {/each}
        </div>
      {/each}
      <select aria-label="Add effect" data-testid="add-effect" value="" onchange={(e) => addEffectOf(e.currentTarget)}>
        <option value="">Add effect…</option>
        {#each EFFECT_KINDS as kind (kind)}<option value={kind}>{EFFECTS[kind].label}</option>{/each}
      </select>
    </section>
  {/if}

  {#if spec.track === TrackKind.Visual}
    <section data-testid="blend-section">
      <h4>Blend mode</h4>
      <div class="row">
        <select aria-label="Blend mode" data-testid="blend-select" value={clip.blend} onchange={(e) => commit(setBlendMode(doc, clip.id, e.currentTarget.value as BlendMode), 'Changed the blend mode')}>
          {#each BLEND_MODES as mode (mode)}<option value={mode}>{BLEND_LABEL[mode]}</option>{/each}
        </select>
      </div>
    </section>

    <section data-testid="parent-section">
      <h4>Parent</h4>
      <div class="row">
        <select aria-label="Parent" data-testid="parent-select" value={clip.parent ?? NO_PARENT} onchange={(e) => commit(setParent(doc, clip.id, e.currentTarget.value === NO_PARENT ? null : e.currentTarget.value, { at: frame }), 'Changed the parent')}>
          <option value={NO_PARENT}>None</option>
          {#each parentChoices(doc, clip.id) as id (id)}<option value={id}>{clipName(id)}</option>{/each}
        </select>
      </div>
      {#if clip.parent}
        <label class="check"><input type="checkbox" data-testid="parent-opacity" checked={clip.parentOpacity === ParentOpacity.Inherit} onchange={(e) => commit(setParentOpacity(doc, clip.id, e.currentTarget.checked ? ParentOpacity.Inherit : ParentOpacity.Ignore), 'Changed opacity inheritance')} />Inherit the parent opacity</label>
      {/if}
    </section>

    <section data-testid="depth-section">
      <h4>Camera depth</h4>
      <div class="row anim">
        <span class="name">{DEPTH.label}</span>
        <div class="range">
          <input type="range" min={DEPTH.min} max={DEPTH.max} step={DEPTH.step} value={clip.depth} disabled={clip.space === Space.Screen} oninput={(e) => commit(setClipDepth(doc, clip.id, { depth: Number(e.currentTarget.value) }), 'Changed depth')} />
          <input class="num" type="text" inputmode="decimal" aria-label="Depth" value={String(clip.depth)} disabled={clip.space === Space.Screen} onchange={(e) => setDepthText(e.currentTarget.value)} />
        </div>
      </div>
      <label class="check"><input type="checkbox" data-testid="screen-space" checked={clip.space === Space.Screen} onchange={(e) => commit(setClipDepth(doc, clip.id, { space: e.currentTarget.checked ? Space.Screen : Space.World }), 'Changed space')} />Screen space: ignores the camera</label>
      {#if !doc.camera}<p class="hint">Depth shows once the video has a camera (Camera track).</p>{/if}
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
          <label for={`f-${field.key}`}>{#if keyedField(clip.component, field.key, animated.params)}{@render diamond(field.key)}{#if field.control === Control.Range}{@render exprToggle(field.key)}{/if}{/if}{field.label}</label>
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
          {:else if field.control === Control.Font}
            <FontPicker value={String(value(field))} fonts={doc.fonts} brand={tokens.fonts ?? []} onpick={(family, catalogue) => pickFont(field, family, catalogue)} onupload={onuploadfont} />
          {:else if field.control === Control.Managed}
            <span class="managed">{managedSummary(value(field))}{#if composeHref} · <a href={composeHref}>Edit in Compositions</a>{/if}</span>
          {/if}
        </div>
        {#if keyedField(clip.component, field.key, animated.params) && field.control === Control.Range}{@render exprEditor(field.key)}{/if}
      {/each}
    </section>
  {/each}

  {/if}

  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
  .managed {
    color: var(--ui-ink-2);
  }

  .managed a {
    color: var(--ui-ink);
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
    border-bottom: 1px solid var(--ui-line);
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid var(--ui-line);
  }

  .tabs button {
    flex: 1;
    padding: 6px 0;
    font-size: 12px;
    color: var(--ui-ink-2);
  }

  .tabs button.on {
    color: var(--ui-ink);
    box-shadow: inset 0 -2px 0 var(--ui-accent);
  }

  .kind {
    font-weight: 600;
    font-size: 13px;
  }

  .id {
    font-family: var(--ui-mono);
    color: var(--ui-ink-2);
  }

  section {
    padding: 12px 12px 14px;
    border-bottom: 1px solid var(--ui-line);
  }

  h4 {
    margin: 0 0 6px;
    font-family: var(--ui-mono);
    font-size: 10px;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ui-ink-3);
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
    border: 1px solid var(--ui-line);
    background: var(--ui-bg);
    color: var(--ui-ink);
    font: inherit;
  }

  input[type='text']:focus,
  input[type='number']:focus,
  textarea:focus,
  select:focus {
    outline: none;
    border-color: var(--ui-accent);
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
    font-family: var(--ui-mono);
  }

  .swatches {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .swatch {
    width: 20px;
    height: 20px;
    border: 1px solid var(--ui-line);
  }

  .swatch.on {
    outline: 2px solid var(--ui-accent);
    outline-offset: 1px;
  }

  input[type='color'] {
    width: 28px;
    height: 22px;
    padding: 0;
    border: 1px solid var(--ui-line);
    background: none;
  }

  .assets {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
  }

  .asset {
    aspect-ratio: 1;
    border: 1px solid var(--ui-line);
    background: var(--ui-surface);
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
    outline: 2px solid var(--ui-accent);
    outline-offset: 1px;
  }

  .empty {
    grid-column: 1 / -1;
    color: var(--ui-ink-2);
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

  .effect {
    border: 1px solid var(--ui-line);
    padding: 6px;
    margin-bottom: 6px;
  }

  .effect.off {
    opacity: 0.5;
  }

  .effect-head {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 4px;
  }

  .effect-name {
    flex: 1;
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .grip {
    cursor: grab;
    color: var(--ui-ink-3);
  }

  .expr-toggle {
    width: 16px;
    margin-right: 4px;
    font-family: var(--ui-mono);
    font-size: 11px;
    color: var(--ui-ink-3);
  }

  .expr-toggle.on {
    color: var(--ui-accent);
  }

  .expr {
    display: grid;
    gap: 4px;
    margin: 0 0 8px;
  }

  .expr .code {
    width: 100%;
    font-family: var(--ui-mono);
    font-size: 11px;
    resize: vertical;
  }

  .expr-error {
    color: #e11d48;
    font-size: 11px;
    margin: 0;
  }

  .expr-now {
    font-family: var(--ui-mono);
    font-size: 10px;
    color: var(--ui-accent);
  }

  .key {
    font-size: 10px;
    line-height: 1;
    width: 14px;
    color: var(--ui-line);
  }

  .key.lane {
    color: var(--ui-ink-2);
  }

  .key.on {
    color: var(--ui-accent);
  }

  .anchor {
    display: grid;
    grid-template-columns: repeat(3, 14px);
    gap: 3px;
  }

  .anchor button {
    width: 14px;
    height: 14px;
    border: 1px solid var(--ui-line);
    background: var(--ui-bg);
  }

  .anchor button.on {
    background: var(--ui-accent);
    border-color: var(--ui-accent);
  }

  .check {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  .hint {
    margin: 0 0 8px;
    color: var(--ui-ink-2);
  }

  .error {
    margin: 8px 12px;
    color: var(--sh-destructive);
  }
</style>
