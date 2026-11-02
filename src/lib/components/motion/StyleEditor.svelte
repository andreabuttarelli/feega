<script lang="ts">
  import ColorField from './ColorField.svelte';
  import NumberField from './NumberField.svelte';
  import FontPicker from './FontPicker.svelte';
  import MinusGlyph from './MinusGlyph.svelte';
  import { ColourDisplay } from '$lib/motion/colour-field';
  import { StyleKind, type Style } from '@feega/motion-core/motion/styles-model';
  import { TYPE, TYPE_SIZE } from '@feega/motion-core/motion/components';
  import { BuiltinFont } from '@feega/motion-core/motion/fonts/model';
  import { fractionOf, pxOf } from '$lib/motion/type-px';
  import type { BrandTokens } from '@feega/motion-core/motion/brand';

  const PERCENT = 100;

  let {
    name,
    style,
    swatch,
    tokens,
    unit,
    onrename,
    onremove,
    onedit
  }: { name: string; style: Style; swatch: string | null; tokens: BrandTokens; unit: number; onrename: (to: string) => void; onremove: () => void; onedit: (patch: Record<string, unknown>) => void } = $props();
</script>

<div class="head">
  <input class="text" type="text" value={name} aria-label="Style name" data-testid={`style-library-name-${name}`} onchange={(e) => onrename(e.currentTarget.value)} />
  <button type="button" class="icon" aria-label="Delete style" title="Delete style" data-testid={`style-library-remove-${name}`} onclick={onremove}><MinusGlyph /></button>
</div>
{#if style.kind === StyleKind.Text}
  <span data-testid={`style-library-font-${name}`}><FontPicker value={style.font ?? BuiltinFont.Sans} fonts={[]} brand={tokens.fonts ?? []} onpick={(family) => onedit({ font: family })} /></span>
  <div class="grid">
    <span data-testid={`style-library-size-${name}`}><NumberField label="Size" name="Size" unit="px" value={pxOf(style.size ?? 0, unit)} range={{ min: Math.ceil(TYPE_SIZE.min * unit), max: TYPE_SIZE.max * unit, step: 1 }} onchange={(px) => onedit({ size: fractionOf(px, unit) })} /></span>
    <span data-testid={`style-library-weight-${name}`}><NumberField label="W" name="Weight" value={style.weight ?? 400} range={{ min: TYPE.weight.min, max: TYPE.weight.max, step: 100 }} onchange={(v) => onedit({ weight: Math.round(v) })} /></span>
    <span data-testid={`style-library-tracking-${name}`}><NumberField label="Tr" name="Tracking" unit="%" value={(style.tracking ?? 0) * PERCENT} range={{ min: TYPE.tracking.min * PERCENT, max: TYPE.tracking.max * PERCENT, step: 0.5 }} onchange={(v) => onedit({ tracking: v / PERCENT })} /></span>
    <span data-testid={`style-library-leading-${name}`}><NumberField label="Ld" name="Leading" value={style.leading ?? 1.2} range={TYPE.leading} onchange={(v) => onedit({ leading: v })} /></span>
  </div>
{/if}
{#if (style.kind === StyleKind.Text && style.color) || style.kind === StyleKind.Colour}
  <span data-testid={`style-library-colour-${name}`}><ColorField {name} display={ColourDisplay.Field} value={swatch} {tokens} onchange={(v) => onedit({ color: v })} /></span>
{/if}

<style>
  .head {
    display: grid;
    grid-template-columns: 1fr 20px;
    align-items: center;
    gap: var(--ui-space-2);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--ui-space-2);
  }

  .icon {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-tertiary);
    cursor: pointer;
  }

  .icon:hover {
    background: var(--ui-wash);
    color: var(--ui-text);
  }

  .text {
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
    padding: 4px 6px;
    border: 1px solid var(--ui-line);
    border-radius: var(--ui-radius-sm);
    background: var(--ui-surface);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-type-caption);
  }
</style>
