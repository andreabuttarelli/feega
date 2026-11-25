<script lang="ts">
  import Pipette from '@lucide/svelte/icons/pipette';
  import Plus from '@lucide/svelte/icons/plus';
  import type { ColourPick, Palette } from '../messages';
  import { ColourFormat, formatColour, hexToHsv, hsvToRgb, parseRgba, rgbaCss, type Hsv } from './colour-math';
  import { liveColour } from './colour-live';
  import { tokenPick } from './colour-theme';

  type Props = { value: string; palette: Palette; onchange: (pick: ColourPick) => void; onpreview?: (css: string) => void; onsave?: (name: string, css: string) => void };

  let { value, palette, onchange, onpreview = () => undefined, onsave }: Props = $props();

  const KEY_STEP = 0.01;
  const HUE_STEP = 2;
  const COARSE = 10;
  const FORMATS = Object.values(ColourFormat);

  let hsv = $state<Hsv>({ h: 0, s: 0, v: 0 });
  let alpha = $state(1);
  let format = $state(ColourFormat.Hex);
  let naming = $state<string | null>(null);
  let square = $state<HTMLDivElement | null>(null);

  $effect(() => {
    const parsed = parseRgba(value) ?? { r: 0, g: 0, b: 0, a: 1 };
    hsv = hexToHsv(rgbaCss({ ...parsed, a: 1 }));
    alpha = parsed.a;
  });

  const rgba = $derived({ ...hsvToRgb(hsv), a: alpha });
  const css = $derived(rgbaCss(rgba));
  const hueCss = $derived(`hsl(${hsv.h} 100% 50%)`);

  const emit = () => onchange({ css });
  const live = liveColour({
    preview: (v) => onpreview(v),
    commit: (v) => onchange({ css: v }),
    frame: (run) => requestAnimationFrame(run),
    later: (run, ms) => {
      const id = setTimeout(run, ms);
      return () => clearTimeout(id);
    }
  });
  const drag = () => live.drag(hsv, alpha);
  const drop = () => live.drop(hsv, alpha);

  function onSquare(e: PointerEvent) {
    if (e.type === 'pointerdown') {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } else if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      return;
    }
    const r = square!.getBoundingClientRect();
    hsv = { ...hsv, s: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), v: Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height)) };
    drag();
  }

  function squareKey(e: KeyboardEvent) {
    const step = KEY_STEP * (e.shiftKey ? COARSE : 1);
    const moves: Record<string, Partial<Hsv>> = { ArrowLeft: { s: hsv.s - step }, ArrowRight: { s: hsv.s + step }, ArrowUp: { v: hsv.v + step }, ArrowDown: { v: hsv.v - step } };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      hsv = { h: hsv.h, s: Math.min(1, Math.max(0, move.s ?? hsv.s)), v: Math.min(1, Math.max(0, move.v ?? hsv.v)) };
      emit();
    }
  }

  async function pickFromScreen() {
    const Dropper = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
    if (!Dropper) {
      return;
    }
    const picked = await new Dropper().open().catch(() => null);
    if (picked) {
      onchange({ css: picked.sRGBHex });
    }
  }

  function typedHex(raw: string) {
    const parsed = parseRgba(raw.startsWith('#') ? raw : `#${raw}`);
    if (parsed) {
      onchange({ css: rgbaCss({ ...parsed, a: alpha }) });
    }
  }

  const shortName = (name: string) => name.replace(/^--(color-)?/, '');
</script>

<div class="picker" data-testid="colour-picker">
  {#if palette.tokens.length}
    <div class="group">
      <span class="group-title">Project</span>
      <div class="swatches">
        {#each palette.tokens as t (t.name)}
          <button type="button" class="chip" title={`${t.name}: ${t.value}`} aria-label={t.name} style={`background:${t.value}`} onclick={() => onchange(tokenPick(t.name))}></button>
        {/each}
      </div>
    </div>
  {/if}
  <div
    class="square"
    bind:this={square}
    style={`background: linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueCss})`}
    role="slider"
    tabindex="0"
    aria-label="Saturation and brightness"
    aria-valuenow={Math.round(hsv.s * 100)}
    onpointerdown={onSquare}
    onpointermove={onSquare}
    onpointerup={drop}
    onkeydown={squareKey}
  >
    <span class="handle" style={`left:${hsv.s * 100}%;top:${(1 - hsv.v) * 100}%;background:${css}`}></span>
  </div>

  <input class="hue" type="range" min="0" max="360" step={HUE_STEP} value={hsv.h} aria-label="Hue" oninput={(e) => ((hsv = { ...hsv, h: Number(e.currentTarget.value) }), drag())} onchange={drop} />
  <input class="alpha" type="range" min="0" max="1" step="0.01" value={alpha} aria-label="Opacity" style={`--solid: ${rgbaCss({ ...rgba, a: 1 })}`} oninput={(e) => ((alpha = Number(e.currentTarget.value)), drag())} onchange={drop} />

  <div class="values">
    <button type="button" class="icon" title="Pick a colour from the screen" aria-label="Eyedropper" onclick={pickFromScreen}><Pipette size={14} /></button>
    {#if format === ColourFormat.Hex}
      <input class="hex" type="text" value={formatColour(rgba, format)} aria-label="Hex" onchange={(e) => typedHex(e.currentTarget.value)} />
    {:else}
      <span class="hex">{formatColour(rgba, format)}</span>
    {/if}
    <span class="pct">{Math.round(alpha * 100)}%</span>
    <select class="format" value={format} aria-label="Colour format" onchange={(e) => (format = e.currentTarget.value as ColourFormat)}>
      {#each FORMATS as f (f)}<option value={f}>{f}</option>{/each}
    </select>
  </div>

  {#if palette.document.length}
    <div class="group">
      <span class="group-title">Page</span>
      <div class="swatches">
        {#each palette.document as c (c)}
          <button type="button" class="chip" title={c} aria-label={c} style={`background:${c}`} onclick={() => onchange({ css: c })}></button>
        {/each}
      </div>
    </div>
  {/if}

  {#if onsave}
    {#if naming === null}
      <button type="button" class="save" onclick={() => (naming = 'brand')}><Plus size={12} /> Save as variable</button>
    {:else}
      <form class="naming" onsubmit={(e) => (e.preventDefault(), naming && onsave(naming, css), (naming = null))}>
        <span class="dashes">--</span>
        <input type="text" bind:value={naming} aria-label="Variable name" />
        <button type="submit" class="save-ok">Save</button>
      </form>
    {/if}
  {/if}
  {#if palette.tokens.length}<p class="hint">{palette.tokens.length} project colours · e.g. {shortName(palette.tokens[0].name)}</p>{/if}
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 224px;
  }

  .square {
    position: relative;
    height: 150px;
    border-radius: var(--ui-radius-sm);
    cursor: crosshair;
    touch-action: none;
  }

  .handle {
    position: absolute;
    width: 12px;
    height: 12px;
    margin: -6px 0 0 -6px;
    border-radius: var(--ui-radius-full);
    box-shadow: 0 0 0 2px #fff, 0 0 0 3px rgb(0 0 0 / 0.3);
    pointer-events: none;
  }

  input[type='range'] {
    width: 100%;
    height: 12px;
    margin: 0;
    border-radius: var(--ui-radius-full);
    appearance: none;
    box-shadow: none !important;
    cursor: pointer;
  }

  input[type='range']::-webkit-slider-thumb {
    width: 14px;
    height: 14px;
    border-radius: var(--ui-radius-full);
    background: #fff;
    box-shadow: 0 0 0 1px rgb(0 0 0 / 0.3), 0 1px 2px rgb(0 0 0 / 0.3);
    appearance: none;
  }

  .hue {
    background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  }

  .alpha {
    background:
      linear-gradient(to right, transparent, var(--solid)),
      repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 8px 8px;
  }

  .values {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 28px;
    padding: 0 4px 0 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
  }

  .hex {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    border: 0;
    background: none;
    box-shadow: none !important;
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-sm);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .pct {
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
    font-variant-numeric: tabular-nums;
  }

  .format {
    border: 0;
    background: none;
    box-shadow: none !important;
    color: var(--ui-text-3);
    font: inherit;
    font-size: var(--ui-text-xs);
    appearance: none;
    cursor: pointer;
  }

  .icon {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 0;
    background: none;
    color: var(--ui-text-2);
    cursor: pointer;
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .group-title {
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
    font-weight: 600;
  }

  .swatches {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 4px;
  }

  .chip {
    aspect-ratio: 1;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-xs);
    box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.2);
    cursor: pointer;
  }

  .save {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .naming {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 28px;
    padding-left: 8px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
  }

  .naming input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    box-shadow: none !important;
    color: var(--ui-text);
    font: inherit;
  }

  .dashes {
    color: var(--ui-text-3);
  }

  .save-ok {
    height: 24px;
    margin-right: 2px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .hint {
    margin: 0;
    color: var(--ui-text-3);
    font-size: var(--ui-text-xs);
  }
</style>
