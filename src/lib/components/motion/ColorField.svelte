<script lang="ts">
  import { localStore } from '$lib/browser-storage';
  import { onMount } from 'svelte';
  import { BRAND_COLORS } from '$lib/motion/components';
  import { resolveColor, type BrandTokens } from '$lib/motion/brand';
  import { COLOUR_FORMATS, ColourFormat, channelsOf, colourLabel, fromChannels, parseColour, readRecent, remember, type Channels } from '$lib/motion/colour-field';
  import IconButton from './IconButton.svelte';
  import { Action } from '$lib/motion/actions';
  import type { LayoutStore } from '$lib/motion/editor-layout';

  let {
    id,
    name,
    value,
    tokens,
    alpha = null,
    onchange,
    onalpha
  }: { id?: string; name: string; value: unknown; tokens: BrandTokens; alpha?: number | null; onchange: (value: string) => void; onalpha?: (alpha: number) => void } = $props();

  type EyeDropperResult = { sRGBHex: string };
  type EyeDropperCtor = new () => { open: () => Promise<EyeDropperResult> };

  const PERCENT = 100;
  const FORMAT_LABEL: Record<ColourFormat, string> = { [ColourFormat.Hex]: 'HEX', [ColourFormat.Rgb]: 'RGB', [ColourFormat.Hsl]: 'HSL' };
  const CHANNEL_NAMES: Record<ColourFormat, string[]> = { [ColourFormat.Hex]: ['Hex'], [ColourFormat.Rgb]: ['R', 'G', 'B'], [ColourFormat.Hsl]: ['H', 'S', 'L'] };

  let format = $state(ColourFormat.Hex);
  let dropper = $state<EyeDropperCtor | null>(null);

  const HEX = /^#[0-9a-f]{6}$/i;
  const NONE = '#000000';

  let open = $state(false);
  let recent = $state<string[]>([]);
  let root = $state<HTMLDivElement | null>(null);

  const raw = $derived(typeof value === 'string' ? value : '');
  const shown = $derived(resolveColor(raw || undefined, tokens));
  const pickerValue = $derived(HEX.test(shown) ? shown : NONE);

  onMount(() => {
    recent = readRecent(localStore());
    dropper = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper ?? null;
  });

  const channels = $derived(channelsOf(pickerValue, format));

  function setChannel(index: number, text: string) {
    const next: Channels = channels.map((c, i) => (i === index ? text : c));
    const hex = fromChannels(format, next);
    if (hex) {
      pick(hex);
    }
  }

  async function sample() {
    if (!dropper) {
      return;
    }
    try {
      pick((await new dropper().open()).sRGBHex.toLowerCase());
    } catch {
      return;
    }
  }

  function setAlpha(text: string) {
    const n = Number(text.replace('%', ''));
    if (Number.isFinite(n)) {
      onalpha?.(Math.min(1, Math.max(0, n / PERCENT)));
    }
  }

  function pick(next: string) {
    if (HEX.test(next)) {
      recent = remember(recent, next.toLowerCase(), localStore());
    }
    onchange(next);
  }

  function typed(input: HTMLInputElement) {
    const parsed = parseColour(input.value);
    if (parsed === null) {
      input.value = colourLabel(raw);
      return;
    }
    pick(parsed);
  }

  function closeOutside(e: PointerEvent) {
    if (open && root && !root.contains(e.target as Node)) {
      open = false;
    }
  }

  function closeOnEscape(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      open = false;
    }
  }
</script>

<svelte:window onpointerdown={closeOutside} />

<div class="colour" bind:this={root} data-colour={name} role="group" aria-label={name} onkeydown={closeOnEscape}>
  <button type="button" class="chip" style={`--c: ${shown};`} aria-label={`Pick ${name}`} aria-expanded={open} onclick={() => (open = !open)}></button>
  <input {id} class="hex" type="text" spellcheck="false" aria-label={name} value={colourLabel(raw)} onchange={(e) => typed(e.currentTarget)} onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
  {#if onalpha}<input class="alpha" type="text" inputmode="decimal" aria-label={`${name} opacity`} value={`${Math.round((alpha ?? 1) * PERCENT)}%`} onchange={(e) => setAlpha(e.currentTarget.value)} />{/if}
  {#if open}
    <div class="pop" role="dialog" aria-label={`${name} colours`} data-testid="colour-popover">
      <input class="wheel" type="color" aria-label={`${name} picker`} value={pickerValue} onchange={(e) => pick(e.currentTarget.value)} />
      <div class="formats">
        <div class="switch" role="radiogroup" aria-label="Colour format">
          {#each COLOUR_FORMATS as f (f)}<button type="button" role="radio" aria-checked={format === f} class:on={format === f} onclick={() => (format = f)}>{FORMAT_LABEL[f]}</button>{/each}
        </div>
        {#if dropper}<IconButton action={Action.SampleColour} size={14} onclick={sample} />{/if}
      </div>
      <div class="channels" data-format={format}>
        {#each channels as channel, i (`${format}-${i}`)}
          <label><span>{CHANNEL_NAMES[format][i]}</span><input type="text" spellcheck="false" aria-label={`${name} ${CHANNEL_NAMES[format][i]}`} value={String(channel)} onchange={(e) => setChannel(i, e.currentTarget.value)} /></label>
        {/each}
      </div>
      <span class="row-head">Brand</span>
      <div class="row">
        {#each BRAND_COLORS as token (token)}
          <button type="button" class="swatch" class:on={raw === token} style={`--c: ${resolveColor(token, tokens)};`} title={colourLabel(token)} aria-label={colourLabel(token)} onclick={() => pick(token)}></button>
        {/each}
      </div>
      {#if recent.length}
        <span class="row-head">Recent</span>
        <div class="row">
          {#each recent as hex (hex)}
            <button type="button" class="swatch" class:on={raw === hex} style={`--c: ${hex};`} title={colourLabel(hex)} aria-label={colourLabel(hex)} onclick={() => pick(hex)}></button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .colour {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    height: var(--ui-row);
    min-width: 0;
    padding: 0 6px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    border: 1px solid transparent;
  }

  .colour:hover {
    border-color: var(--ui-line-strong);
  }

  .colour:focus-within {
    border-color: var(--ui-accent);
  }

  .chip {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    padding: 0;
    border: 1px solid var(--ui-line-strong);
    border-radius: var(--ui-radius-sm);
    background: var(--c);
    cursor: pointer;
  }

  .hex {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-ink);
    font: inherit;
    font-size: var(--ui-text-xs);
    font-variant-numeric: tabular-nums;
    outline: none;
  }

  .alpha {
    width: 40px;
    flex-shrink: 0;
    height: 100%;
    padding: 0;
    border: 0;
    border-left: 1px solid var(--ui-line-strong);
    padding-left: 6px;
    background: transparent;
    color: var(--ui-ink);
    font: inherit;
    font-size: var(--ui-text-xs);
    outline: none;
  }

  .formats {
    display: flex;
    gap: 4px;
  }

  .switch {
    display: flex;
    flex: 1;
    padding: 2px;
    gap: 2px;
    background: var(--ui-input);
  }

  .switch button {
    flex: 1;
    height: 22px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-ink-3);
    font: inherit;
    font-size: 10px;
    cursor: pointer;
  }

  .switch button.on {
    background: var(--ui-bg);
    color: var(--ui-ink);
  }


  .channels {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 4px;
  }

  .channels label {
    display: flex;
    align-items: center;
    height: 24px;
    background: var(--ui-input);
    color: var(--ui-ink-3);
    font-size: 10px;
  }

  .channels span {
    padding: 0 4px 0 6px;
  }

  .channels input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ui-ink);
    font: inherit;
    font-size: var(--ui-text-xs);
    outline: none;
  }

  .pop {
    position: absolute;
    z-index: 20;
    top: calc(100% + 4px);
    right: -1px;
    display: grid;
    gap: 6px;
    width: 196px;
    padding: 8px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-panel-raised);
    box-shadow: var(--ui-shadow-float);
  }

  .wheel {
    width: 100%;
    height: 96px;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    cursor: crosshair;
  }

  .row-head {
    color: var(--ui-ink-3);
    font-size: 10px;
  }

  .row {
    display: grid;
    grid-template-columns: repeat(8, 18px);
    gap: 4px;
  }

  .swatch {
    width: 18px;
    height: 18px;
    padding: 0;
    border: 1px solid var(--ui-line-strong);
    border-radius: var(--ui-radius-sm);
    background: var(--c);
    cursor: pointer;
  }

  .swatch.on {
    outline: 2px solid var(--ui-accent);
    outline-offset: 1px;
  }

  @media (pointer: coarse) {
    .colour {
      height: 44px;
    }

    .chip,
    .swatch {
      width: 28px;
      height: 28px;
    }

    .row {
      grid-template-columns: repeat(5, 28px);
    }
  }
</style>
