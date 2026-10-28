<script lang="ts">
  import FontPicker from './FontPicker.svelte';
  import type { MotionDoc } from '@feega/motion-core/motion/doc';
  import type { BrandTokens } from '@feega/motion-core/motion/brand';
  import { resolveColor } from '@feega/motion-core/motion/brand';
  import type { FontLibrary } from '$lib/motion/fonts/library';
  import type { CatalogueFont } from '@feega/motion-core/motion/fonts/model';
  import { registerFont } from '$lib/motion/fonts/ops';
  import { FontOrigin, withPicked } from '$lib/motion/fonts/local';
  import { textRange } from '$lib/canvas/text-range.svelte';
  import { ListKind } from '@feega/motion-core/motion/text-lists';
  import { MIXED, RUN_CASES, linkOf, type GradientFill, type RunEdit, type StyleKey } from '@feega/motion-core/motion/text-runs';
  import { FILL_LABEL, FillType, addStop, removeStop } from '@feega/motion-core/motion/fill/model';
  import { GRADIENT_TYPES, RunPaint, asGradient, gradientPatched, paintOf } from '$lib/motion/run-fill';

  let { doc, tokens, fonts = null, onchange }: { doc: MotionDoc; tokens: BrandTokens; fonts?: FontLibrary | null; onchange: (doc: MotionDoc, summary: string) => void } = $props();

  const values = $derived(textRange.values);
  const MIXED_LABEL = 'Mixed';
  const PERCENT = 100;

  type NumberField = { key: Extract<StyleKey, 'size' | 'weight' | 'tracking' | 'leading' | 'opacity'>; label: string; step: number; scale: number };

  const NUMBERS: NumberField[] = [
    { key: 'size', label: 'Size', step: 0.005, scale: 1 },
    { key: 'weight', label: 'Weight', step: 100, scale: 1 },
    { key: 'tracking', label: 'Letter spacing', step: 0.005, scale: 1 },
    { key: 'leading', label: 'Line height', step: 0.05, scale: 1 },
    { key: 'opacity', label: 'Opacity %', step: 1, scale: PERCENT }
  ];

  const FLAGS: { key: Extract<StyleKey, 'italic' | 'underline' | 'strike'>; label: string }[] = [
    { key: 'italic', label: 'I' },
    { key: 'underline', label: 'U' },
    { key: 'strike', label: 'S' }
  ];

  const shown = (v: unknown, scale = 1) => (v === MIXED ? '' : typeof v === 'number' ? String(Math.round(v * scale * 1000) / 1000) : String(v ?? ''));

  function set(edit: RunEdit) {
    textRange.restyle(edit);
  }

  function setNumber(field: NumberField, raw: string) {
    const n = Number(raw);
    if (raw.trim() !== '' && Number.isFinite(n)) {
      set({ [field.key]: n / field.scale });
    }
  }

  function setLink(raw: string) {
    const link = linkOf(raw);
    if (link !== undefined) {
      set({ link });
    }
  }

  function pickFont(asked: string, catalogue: CatalogueFont[], origin: FontOrigin) {
    const { doc: base, family } = withPicked(doc, asked, origin, fonts?.families ?? []);
    const registered = registerFont(base, family, catalogue);
    if (registered.ok) {
      onchange(registered.doc, `Added the font ${family}`);
    }
    set({ font: family });
  }

  const colourOf = (v: unknown) => (v === MIXED || typeof v !== 'string' ? '#000000' : resolveColor(v, tokens));

  const SOLID = 'solid';
  const DEFAULT_STOP = 0.5;
  const paint = $derived(values ? paintOf(values) : RunPaint.Solid);
  const gradient = $derived(values && values.fill !== MIXED ? (values.fill ?? null) : null);
  const baseColour = $derived(colourOf(values?.color));

  function pickPaint(kind: string) {
    if (kind === SOLID) {
      set({ color: baseColour, fill: null });
      return;
    }
    set({ fill: asGradient(gradient ?? undefined, kind as (typeof GRADIENT_TYPES)[number], baseColour), color: null });
  }

  function patchGradient(patch: Record<string, unknown>) {
    if (gradient) {
      set({ fill: gradientPatched(gradient, patch) });
    }
  }

  function patchStop(i: number, patch: Partial<GradientFill['stops'][number]>) {
    if (gradient) {
      patchGradient({ stops: gradient.stops.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
    }
  }

  const setStopPos = (i: number, raw: string) => Number.isFinite(Number(raw)) && raw.trim() !== '' && patchStop(i, { pos: Math.max(0, Math.min(1, Number(raw) / PERCENT)) });
</script>

{#if values}
  <section class="range ui-section" data-testid="range-text-inspector" data-text-range-panel>
    <header>Text · selection</header>
    <div class="row">
      <span>Font</span>
      {#if values.font === MIXED}<span class="mixed" data-testid="range-mixed-font">{MIXED_LABEL}</span>{/if}
      <FontPicker value={values.font === MIXED ? '' : String(values.font)} fonts={doc.fonts} brand={tokens.fonts ?? []} onpick={pickFont} library={fonts} />
    </div>
    {#each NUMBERS as field (field.key)}
      <label class="row">
        <span>{field.label}</span>
        <input type="number" step={field.step * field.scale} data-testid={`range-${field.key}`} placeholder={values[field.key] === MIXED ? MIXED_LABEL : ''} value={shown(values[field.key], field.scale)} onchange={(e) => setNumber(field, e.currentTarget.value)} />
      </label>
    {/each}
    <label class="row">
      <span>Fill</span>
      <select data-testid="range-fill-type" value={paint === RunPaint.Mixed ? '' : paint === RunPaint.Solid ? SOLID : (gradient?.type ?? SOLID)} onchange={(e) => pickPaint(e.currentTarget.value)}>
        {#if paint === RunPaint.Mixed}<option value="">{MIXED_LABEL}</option>{/if}
        <option value={SOLID}>Solid</option>
        {#each GRADIENT_TYPES as type (type)}<option value={type}>{FILL_LABEL[type]}</option>{/each}
      </select>
    </label>
    {#if paint !== RunPaint.Gradient}
      <label class="row">
        <span>Colour</span>
        <input type="color" data-testid="range-color" value={colourOf(values.color)} onchange={(e) => set({ color: e.currentTarget.value, fill: null })} />
        {#if values.color === MIXED}<span class="mixed">{MIXED_LABEL}</span>{/if}
      </label>
    {:else if gradient}
      {#if gradient.type === FillType.Linear || gradient.type === FillType.Angular}
        <label class="row">
          <span>Angle</span>
          <input type="number" step="5" data-testid="range-gradient-angle" value={Math.round(gradient.angle)} onchange={(e) => patchGradient({ angle: Number(e.currentTarget.value) })} />
        </label>
      {/if}
      {#each gradient.stops as stop, i (i)}
        <div class="row stop" data-testid="range-gradient-stop">
          <input type="color" value={colourOf(stop.color)} onchange={(e) => patchStop(i, { color: e.currentTarget.value })} />
          <input type="number" min="0" max="100" step="1" value={Math.round(stop.pos * PERCENT)} onchange={(e) => setStopPos(i, e.currentTarget.value)} />
          <button type="button" title="Remove stop" disabled={gradient.stops.length <= 2} onclick={() => patchGradient({ stops: removeStop(gradient.stops, i) })}>×</button>
        </div>
      {/each}
      <button type="button" class="add" data-testid="range-gradient-add" onclick={() => patchGradient({ stops: addStop(gradient.stops, DEFAULT_STOP) })}>Add stop</button>
    {/if}
    <label class="row">
      <span>Case</span>
      <select data-testid="range-case" value={values.textCase === MIXED ? '' : values.textCase} onchange={(e) => set({ textCase: e.currentTarget.value as (typeof RUN_CASES)[number] })}>
        {#if values.textCase === MIXED}<option value="">{MIXED_LABEL}</option>{/if}
        {#each RUN_CASES as c (c)}<option value={c}>{c}</option>{/each}
      </select>
    </label>
    <label class="row">
      <span>Link</span>
      <input type="url" data-testid="range-link" placeholder={values.link === MIXED ? MIXED_LABEL : 'https://'} value={shown(values.link)} onchange={(e) => setLink(e.currentTarget.value)} />
    </label>
    <div class="flags" data-testid="range-lists">
      <button type="button" title="Bulleted list (⇧⌘8)" data-testid="range-list-bullet" class:on={textRange.listKind === ListKind.Bullet} onclick={() => (textRange.listKind === ListKind.Bullet ? textRange.unlist() : textRange.setList(ListKind.Bullet))}>•</button>
      <button type="button" title="Numbered list (⇧⌘7)" data-testid="range-list-number" class:on={textRange.listKind === ListKind.Number} onclick={() => (textRange.listKind === ListKind.Number ? textRange.unlist() : textRange.setList(ListKind.Number))}>1.</button>
      <button type="button" title="Lift (⇧Tab)" data-testid="range-list-lift" disabled={!textRange.listed} onclick={() => textRange.indent(-1)}>←</button>
      <button type="button" title="Nest (Tab)" data-testid="range-list-nest" disabled={!textRange.listed} onclick={() => textRange.indent(1)}>→</button>
    </div>
    <div class="flags">
      {#each FLAGS as flag (flag.key)}
        <button type="button" data-testid={`range-${flag.key}`} class:on={values[flag.key] === true} class:mixed={values[flag.key] === MIXED} onclick={() => set({ [flag.key]: values[flag.key] !== true })}>{flag.label}</button>
      {/each}
    </div>
  </section>
{/if}

<style>
  .range {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2);
    padding: var(--ui-space-3) var(--ui-space-4);
    font-size: var(--ui-type-caption);
  }

  header {
    font-weight: 600;
    color: var(--ui-text);
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 2fr auto;
    align-items: center;
    gap: var(--ui-space-2);
    color: var(--ui-text-secondary);
  }

  input,
  select {
    min-width: 0;
    padding: 4px 6px;
    border: 1px solid transparent;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
  }

  input[type='color'] {
    padding: 0;
    height: 24px;
  }

  .stop {
    grid-template-columns: 1fr 2fr auto;
  }

  .stop button,
  .add {
    height: 24px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text);
    cursor: pointer;
  }

  .mixed {
    color: var(--ui-text-tertiary);
    font-style: italic;
  }

  .flags {
    display: flex;
    gap: var(--ui-space-1);
  }

  .flags button {
    width: 28px;
    height: 24px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text);
    cursor: pointer;
  }

  .flags button.on {
    background: var(--ui-hover);
    border-color: var(--ui-accent, #3b82f6);
  }
</style>
