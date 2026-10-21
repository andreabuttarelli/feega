<script lang="ts">
  import Layers from '@lucide/svelte/icons/layers';
  import type { Bounds } from '$lib/motion/scene-select';
  import { findClip, type MotionClip, type MotionDoc } from '$lib/motion/doc';
  import { EditMode, editIn } from '$lib/motion/edit-mode';
  import { valueAt } from '$lib/motion/inspector';
  import { withParams } from '$lib/motion/custom/params';
  import { TRANSFORM, isAnimatable } from '$lib/motion/keyframes';
  import { sliderOf, toShown, toStored } from '$lib/motion/units';
  import { fieldLook } from '$lib/motion/inspector-sections';
  import { BLEND_MODES, blendLabel, type BlendMode } from '$lib/motion/blend';
  import { setBlendMode } from '$lib/motion/blend-ops';
  import { MIXED, shared, type Shared } from '$lib/motion/mixed';
  import { FieldKind } from '$lib/motion/number-field';
  import type { OpResult } from '$lib/motion/timeline';
  import { aabb, quadOf, type Boxes } from '$lib/motion/scene-select';
  import { unionBounds } from '$lib/motion/multi-select';
  import { HORIZONTALS, VERTICALS } from '$lib/motion/constraints/model';
  import { setConstraints } from '$lib/motion/constraints/constraints';
  import { PropKind, STYLE_PROPS, placeBox, setPropAcross, sharedConstraint, sharedProp, type BoxPatch } from '$lib/motion/selection-props';
  import NumberField from './NumberField.svelte';

  let { doc, ids, frame, mode = EditMode.Motion, boxes = {}, onchange }: { doc: MotionDoc; ids: readonly string[]; frame: number; mode?: EditMode; boxes?: Boxes; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  const BOX_FIELDS = [
    { key: 'x', label: 'X', of: (b: Bounds) => b.left },
    { key: 'y', label: 'Y', of: (b: Bounds) => b.top },
    { key: 'width', label: 'W', of: (b: Bounds) => b.right - b.left },
    { key: 'height', label: 'H', of: (b: Bounds) => b.bottom - b.top }
  ] as const;
  const BOX_RANGE = { min: -100000, max: 100000, step: 1 };
  const PROP_RANGE = { min: 0, max: 100000, step: 1 };
  const HEX = /^#[0-9a-f]{6}$/i;
  const FALLBACK_COLOUR = '#000000';

  const SHARED_KEYS = ['x', 'y', 'rotateZ', 'scale', 'opacity', 'anchorX', 'anchorY'] as const;
  type SharedKey = (typeof SHARED_KEYS)[number];
  const MIXED_OPTION = '';

  const clips = $derived(ids.map((id) => findClip(doc, id)?.clip).filter((c): c is MotionClip => !!c));
  const first = $derived(clips[0]);
  const bounds = $derived(ids.length && ids.every((id) => boxes[id] && findClip(doc, id)) ? unionBounds(ids.map((id) => aabb(quadOf(doc, id, frame, boxes[id])))) : null);
  const styleProps = $derived(STYLE_PROPS.filter((f) => clips.some((c) => c.props[f.key] !== undefined)));
  const ownerOf = (key: string) => clips.find((c) => c.props[key] !== undefined)!;
  const sameColour = (c: string) => c;

  const numberOf = (clip: MotionClip, key: SharedKey) => toShown(clip.component, key, Math.round(Number(valueAt(withParams(doc, clip), key, frame, sameColour) ?? TRANSFORM[key].fallback) * 1000) / 1000, doc);
  const valueOf = (key: SharedKey): Shared<number> => shared(clips.filter((c) => isAnimatable(c.component, key)).map((c) => numberOf(c, key)));
  const blend = $derived(shared(clips.map((c) => c.blend)));

  function across(edit: (doc: MotionDoc, clip: MotionClip) => OpResult, summary: string) {
    let next = doc;
    for (const id of ids) {
      const clip = findClip(next, id)?.clip;
      if (!clip) {
        continue;
      }
      const result = edit(next, clip);
      if (!result.ok) {
        return;
      }
      next = result.doc;
    }
    onchange(next, summary);
  }

  const setNumber = (key: SharedKey, shown: number) => across((d, clip) => (isAnimatable(clip.component, key) ? editIn(mode, d, clip, key, toStored(clip.component, key, shown, d), frame) : { ok: true, doc: d }), `Edited ${TRANSFORM[key].label.toLowerCase()} on ${ids.length} clips`);
  function setBox(patch: BoxPatch) {
    const result = bounds ? placeBox(doc, [...ids], frame, bounds, patch, mode) : null;
    if (result?.ok) {
      onchange(result.doc, `Placed ${ids.length} layers`);
    }
  }

  function setStyle(key: string, value: unknown) {
    const result = setPropAcross(doc, ids, key, value);
    if (result.ok) {
      onchange(result.doc, `Edited ${key} on ${ids.length} layers`);
    }
  }

  const numberProp = (key: string): Shared<number> => {
    const raw = sharedProp(clips, key);
    return raw === MIXED ? MIXED : toShown(ownerOf(key).component, key, Number(raw), doc);
  };
  const colourProp = (key: string) => {
    const raw = sharedProp(clips, key);
    return typeof raw === 'string' && HEX.test(raw) ? raw : FALLBACK_COLOUR;
  };
  const textProp = (key: string) => {
    const raw = sharedProp(clips, key);
    return raw === MIXED ? '' : String(raw);
  };

  const horizontal = $derived(sharedConstraint(clips, 'horizontal'));
  const vertical = $derived(sharedConstraint(clips, 'vertical'));
  const setPin = (axis: 'horizontal' | 'vertical', value: string) => {
    const result = value === MIXED_OPTION ? null : setConstraints(doc, [...ids], { [axis]: value });
    if (result?.ok) {
      onchange(result.doc, `Pinned ${ids.length} layers`);
    }
  };

  const setBlend = (value: string) => value !== MIXED_OPTION && across((d, clip) => setBlendMode(d, clip.id, value as BlendMode), `Changed the blend mode on ${ids.length} clips`);
</script>

<div class="multi" data-testid="multi-inspector">
  <header class="head">
    <span class="icon"><Layers size={14} /></span>
    <span class="name">{ids.length} layers</span>
    <span class="kind">Mixed selection</span>
  </header>
  {#if first}
    {#if bounds}
      <section class="section" data-section="box">
        <h3>Selection</h3>
        <div class="grid2">
          {#each BOX_FIELDS as f (f.key)}
            <div data-prop={f.key}>
              <NumberField label={f.label} kind={FieldKind.Glyph} name={`Selection ${f.key}`} value={Math.round(f.of(bounds) * 100) / 100} range={BOX_RANGE} unit="px" onchange={(v) => setBox({ [f.key]: v })} />
            </div>
          {/each}
        </div>
      </section>
    {/if}
    <section class="section" data-section="layout">
      <h3>Layout</h3>
      <div class="grid2">
        {#each SHARED_KEYS as key (key)}
          {@const look = fieldLook(key)}
          {@const range = sliderOf(first.component, { key, ...TRANSFORM[key] }, doc)}
          <div data-prop={key}>
            <NumberField label={look.short ?? TRANSFORM[key].label} kind={FieldKind.Glyph} name={TRANSFORM[key].label} value={valueOf(key)} {range} unit={range.unit ?? look.unit} onchange={(v) => setNumber(key, v)} />
          </div>
        {/each}
      </div>
    </section>
    {#if styleProps.length}
      <section class="section" data-section="style">
        <h3>Style</h3>
        {#each styleProps as f (f.key)}
          {#if f.kind === PropKind.Number}
            <div data-prop={f.key}>
              <NumberField label={f.label} kind={FieldKind.Named} name={f.label} value={numberProp(f.key)} range={PROP_RANGE} onchange={(v) => setStyle(f.key, toStored(ownerOf(f.key).component, f.key, v, doc))} />
            </div>
          {:else if f.kind === PropKind.Colour}
            <label class="line" data-prop={f.key}>
              <span>{f.label}</span>
              <input type="color" aria-label={f.label} value={colourProp(f.key)} onchange={(e) => setStyle(f.key, e.currentTarget.value)} />
              {#if sharedProp(clips, f.key) === MIXED}<em class="mixed">Mixed</em>{/if}
            </label>
          {:else}
            <label class="line" data-prop={f.key}>
              <span>{f.label}</span>
              <input type="text" aria-label={f.label} placeholder="Mixed" value={textProp(f.key)} onchange={(e) => setStyle(f.key, e.currentTarget.value)} />
            </label>
          {/if}
        {/each}
      </section>
    {/if}
    <section class="section" data-section="constraints">
      <h3>Constraints</h3>
      {#each [{ axis: 'horizontal', label: 'Horizontal', value: horizontal, options: HORIZONTALS }, { axis: 'vertical', label: 'Vertical', value: vertical, options: VERTICALS }] as c (c.axis)}
        <label class="line">
          <span>{c.label}</span>
          <select aria-label={`${c.label} constraint`} data-testid={`multi-${c.axis}`} value={c.value === MIXED ? MIXED_OPTION : c.value} onchange={(e) => setPin(c.axis as 'horizontal' | 'vertical', e.currentTarget.value)}>
            {#if c.value === MIXED}<option value={MIXED_OPTION}>Mixed</option>{/if}
            {#each c.options as o (o)}<option value={o}>{o}</option>{/each}
          </select>
        </label>
      {/each}
    </section>
    <section class="section" data-section="layer">
      <h3>Layer</h3>
      <label class="line">
        <span>Blend</span>
        <select aria-label="Blend mode" data-testid="multi-blend" value={blend === MIXED ? MIXED_OPTION : blend} onchange={(e) => setBlend(e.currentTarget.value)}>
          {#if blend === MIXED}<option value={MIXED_OPTION}>Mixed</option>{/if}
          {#each BLEND_MODES as m (m)}<option value={m}>{blendLabel(m)}</option>{/each}
        </select>
      </label>
    </section>
  {/if}
</div>

<style>
  .multi {
    display: flex;
    flex-direction: column;
    font-size: var(--ui-text-xs);
  }

  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--ui-header-h);
    padding: 0 12px;
    border-bottom: 1px solid var(--ui-divider);
    font-size: var(--ui-type-title);
    font-weight: var(--ui-weight-semibold);
  }

  .icon {
    display: inline-flex;
    color: var(--ui-ink-2);
  }

  .name {
    flex: 1;
    font-weight: 600;
    font-size: var(--ui-text-sm);
  }

  .kind {
    color: var(--ui-ink-3);
  }

  .section {
    display: grid;
    gap: 6px;
    padding: 0 var(--ui-space-4) var(--ui-space-4);
  }

  .section + .section {
    border-top: 1px solid var(--ui-line);
  }

  h3 {
    display: flex;
    align-items: center;
    height: 36px;
    margin: 0;
    font-size: var(--ui-text-xs);
    font-weight: 600;
  }

  .grid2 {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 6px;
  }

  .line {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--ui-ink-2);
  }

  .line span {
    width: 88px;
    flex-shrink: 0;
  }

  select {
    flex: 1;
    min-width: 0;
    height: 28px;
    padding: 0 8px;
    border: 1px solid transparent;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-ink);
    font: inherit;
  }

  input[type='text'] {
    flex: 1;
    min-width: 0;
    height: 28px;
    padding: 0 8px;
    border: 1px solid transparent;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-ink);
    font: inherit;
  }

  .mixed {
    color: var(--ui-ink-3);
    font-style: normal;
  }

  select:focus,
  input[type='text']:focus {
    outline: none;
    border-color: var(--ui-accent);
  }
</style>
