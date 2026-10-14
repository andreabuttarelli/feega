<script lang="ts">
  import Layers from '@lucide/svelte/icons/layers';
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
  import NumberField from './NumberField.svelte';

  let { doc, ids, frame, mode = EditMode.Motion, onchange }: { doc: MotionDoc; ids: readonly string[]; frame: number; mode?: EditMode; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  const SHARED_KEYS = ['x', 'y', 'rotateZ', 'scale', 'opacity'] as const;
  type SharedKey = (typeof SHARED_KEYS)[number];
  const MIXED_OPTION = '';

  const clips = $derived(ids.map((id) => findClip(doc, id)?.clip).filter((c): c is MotionClip => !!c));
  const first = $derived(clips[0]);
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
  const setBlend = (value: string) => value !== MIXED_OPTION && across((d, clip) => setBlendMode(d, clip.id, value as BlendMode), `Changed the blend mode on ${ids.length} clips`);
</script>

<div class="multi" data-testid="multi-inspector">
  <header class="head">
    <span class="icon"><Layers size={14} /></span>
    <span class="name">{ids.length} layers</span>
    <span class="kind">Mixed selection</span>
  </header>
  {#if first}
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
    height: 44px;
    padding: 0 var(--ui-space-4);
    border-bottom: 1px solid var(--ui-line);
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
    border-radius: 0;
    background: var(--ui-field);
    color: var(--ui-ink);
    font: inherit;
  }

  select:focus {
    outline: none;
    border-color: var(--ui-accent);
  }
</style>
