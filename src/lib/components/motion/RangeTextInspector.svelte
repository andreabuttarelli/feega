<script lang="ts">
  import FontPicker from './FontPicker.svelte';
  import type { MotionDoc } from '$lib/motion/doc';
  import type { BrandTokens } from '$lib/motion/brand';
  import { resolveColor } from '$lib/motion/brand';
  import type { FontLibrary } from '$lib/motion/fonts/library';
  import type { CatalogueFont } from '$lib/motion/fonts/model';
  import { registerFont, withUploaded } from '$lib/motion/fonts/ops';
  import { textRange } from '$lib/canvas/text-range.svelte';
  import { MIXED, RUN_CASES, type RunEdit, type StyleKey } from '$lib/motion/text-runs';

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

  function pickFont(asked: string, catalogue: CatalogueFont[]) {
    const { doc: base, family } = withUploaded(doc, asked, fonts?.families ?? []);
    const registered = registerFont(base, family, catalogue);
    if (registered.ok) {
      onchange(registered.doc, `Added the font ${family}`);
    }
    set({ font: family });
  }

  const colourOf = (v: unknown) => (v === MIXED || typeof v !== 'string' ? '#000000' : resolveColor(v, tokens));
</script>

{#if values}
  <section class="range" data-testid="range-text-inspector" data-text-range-panel>
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
      <span>Colour</span>
      <input type="color" data-testid="range-color" value={colourOf(values.color)} onchange={(e) => set({ color: e.currentTarget.value })} />
      {#if values.color === MIXED}<span class="mixed">{MIXED_LABEL}</span>{/if}
    </label>
    <label class="row">
      <span>Case</span>
      <select data-testid="range-case" value={values.textCase === MIXED ? '' : values.textCase} onchange={(e) => set({ textCase: e.currentTarget.value as (typeof RUN_CASES)[number] })}>
        {#if values.textCase === MIXED}<option value="">{MIXED_LABEL}</option>{/if}
        {#each RUN_CASES as c (c)}<option value={c}>{c}</option>{/each}
      </select>
    </label>
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
    border-bottom: 1px solid var(--ui-line);
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
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-surface);
    color: var(--ui-text);
    font: inherit;
  }

  input[type='color'] {
    padding: 0;
    height: 24px;
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
