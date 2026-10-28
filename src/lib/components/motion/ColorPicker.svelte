<script lang="ts">
  import { localStore } from '$lib/browser-storage';
  import { onMount } from 'svelte';
  import { BRAND_COLORS } from '@feega/motion-core/motion/components';
  import { resolveColor, type BrandTokens } from '@feega/motion-core/motion/brand';
  import { COLOUR_FORMATS, ColourFormat, alphaOfText, channelsOf, colourLabel, fromChannels, hexOfHsb, hsbOfHex, nudge, parseColour, percentOfAlpha, readRecent, remember, unitAt, type Channels, type Hsb } from '$lib/motion/colour-field';
  import type { LiveGesture } from '$lib/motion/live-edit';
  import IconButton from './IconButton.svelte';
  import { Action } from '$lib/motion/actions';

  let {
    value,
    tokens,
    alpha = null,
    swatches = [],
    gesture = null,
    name = 'Colour',
    onchange
  }: { value: string; tokens: BrandTokens; alpha?: number | null; swatches?: readonly string[]; gesture?: LiveGesture | null; name?: string; onchange: (value: string, alpha?: number) => void } = $props();

  type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> };
  type Track = { rect: DOMRect };

  const HEX = /^#[0-9a-f]{6}$/i;
  const FALLBACK = '#000000';
  const HUNDRED = 100;
  const TURN = 360;
  const STEP = 1;
  const BIG_STEP = 10;
  const FORMAT_LABEL: Record<ColourFormat, string> = { [ColourFormat.Hex]: 'Hex', [ColourFormat.Rgb]: 'RGB', [ColourFormat.Hsl]: 'HSL', [ColourFormat.Hsb]: 'HSB' };
  const CHANNEL_NAMES: Record<ColourFormat, string[]> = { [ColourFormat.Hex]: ['Hex'], [ColourFormat.Rgb]: ['R', 'G', 'B'], [ColourFormat.Hsl]: ['H', 'S', 'L'], [ColourFormat.Hsb]: ['H', 'S', 'B'] };
  const CHANNEL_MAX: Record<ColourFormat, number[]> = { [ColourFormat.Hex]: [], [ColourFormat.Rgb]: [255, 255, 255], [ColourFormat.Hsl]: [TURN, HUNDRED, HUNDRED], [ColourFormat.Hsb]: [TURN, HUNDRED, HUNDRED] };
  const BRAND = BRAND_COLORS as readonly string[];

  const shown = $derived(resolveColor(value || undefined, tokens));
  const base = $derived(HEX.test(shown) ? shown.slice(0, 7).toLowerCase() : FALLBACK);
  const level = $derived(alpha ?? 1);

  let format = $state(ColourFormat.Hex);
  let hsb = $state<Hsb>({ h: 0, s: 0, b: 0 });
  let recent = $state<string[]>([]);
  let dropper = $state<EyeDropperCtor | null>(null);
  let queued: (() => void) | null = null;
  let frame = 0;

  $effect(() => {
    if (hexOfHsb(hsb) !== base) {
      hsb = hsbOfHex(base);
    }
  });

  onMount(() => {
    recent = readRecent(localStore());
    dropper = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper ?? null;
    return () => cancelAnimationFrame(frame);
  });

  const channels = $derived(channelsOf(base, format));

  function commit(hex: string, nextAlpha?: number) {
    if (HEX.test(hex)) {
      recent = remember(recent, hex.toLowerCase(), localStore());
    }
    onchange(hex, nextAlpha);
  }

  function schedule(run: () => void) {
    queued = run;
    if (frame) {
      return;
    }
    frame = requestAnimationFrame(flush);
  }

  function flush() {
    frame = 0;
    const run = queued;
    queued = null;
    run?.();
  }

  function setHsb(next: Hsb) {
    hsb = next;
    schedule(() => onchange(hexOfHsb(next)));
  }

  function setLevel(next: number) {
    schedule(() => onchange(base, next));
  }

  function drag(e: PointerEvent, move: (x: number, y: number, track: Track) => void) {
    const el = e.currentTarget as HTMLElement;
    const track = { rect: el.getBoundingClientRect() };
    const at = (m: PointerEvent) => move(unitAt(m.clientX - track.rect.left, track.rect.width), unitAt(m.clientY - track.rect.top, track.rect.height), track);
    el.setPointerCapture(e.pointerId);
    gesture?.begin();
    at(e);
    const onmove = (m: PointerEvent) => at(m);
    const finish = () => {
      el.removeEventListener('pointermove', onmove);
      cancelAnimationFrame(frame);
      flush();
      recent = remember(recent, hexOfHsb(hsb), localStore());
      gesture?.release();
    };
    el.addEventListener('pointermove', onmove);
    el.addEventListener('pointerup', finish, { once: true });
    el.addEventListener('pointercancel', finish, { once: true });
  }

  const dragSquare = (e: PointerEvent) => drag(e, (x, y) => setHsb({ h: hsb.h, s: x * HUNDRED, b: (1 - y) * HUNDRED }));
  const dragHue = (e: PointerEvent) => drag(e, (x) => setHsb({ ...hsb, h: x * TURN }));
  const dragLevel = (e: PointerEvent) => drag(e, (x) => setLevel(Math.round(x * HUNDRED) / HUNDRED));

  const ARROW: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };

  function keySquare(e: KeyboardEvent) {
    const dir = ARROW[e.key];
    if (!dir) {
      return;
    }
    e.preventDefault();
    const step = e.shiftKey ? BIG_STEP : STEP;
    commitHsb({ h: hsb.h, s: nudge(hsb.s, dir[0] * step, HUNDRED), b: nudge(hsb.b, dir[1] * step, HUNDRED) });
  }

  function keyTrack(e: KeyboardEvent, apply: (delta: number) => void) {
    const dir = ARROW[e.key];
    if (!dir) {
      return;
    }
    e.preventDefault();
    apply((dir[0] || dir[1]) * (e.shiftKey ? BIG_STEP : STEP));
  }

  function commitHsb(next: Hsb) {
    hsb = next;
    commit(hexOfHsb(next));
  }

  const keyHue = (e: KeyboardEvent) => keyTrack(e, (d) => commitHsb({ ...hsb, h: nudge(hsb.h, d, TURN) }));
  const keyLevel = (e: KeyboardEvent) => keyTrack(e, (d) => commit(base, nudge(percentOfAlpha(level), d, HUNDRED) / HUNDRED));

  function setChannel(index: number, text: string) {
    const next: Channels = channels.map((c, i) => (i === index ? text : c));
    const hex = fromChannels(format, next);
    if (hex) {
      commit(hex);
    }
  }

  function keyChannel(e: KeyboardEvent, index: number) {
    const input = e.currentTarget as HTMLInputElement;
    if (e.key === 'Enter') {
      input.blur();
      return;
    }
    const dir = ARROW[e.key];
    const max = CHANNEL_MAX[format][index];
    if (!dir || !dir[1] || max === undefined) {
      return;
    }
    e.preventDefault();
    const next = nudge(Number(channels[index]), dir[1] * (e.shiftKey ? BIG_STEP : STEP), max);
    setChannel(index, String(next));
  }

  function typedHex(input: HTMLInputElement) {
    const parsed = parseColour(input.value);
    if (parsed === null || !parsed.colour.startsWith('#')) {
      input.value = String(channels[0]);
      return;
    }
    input.value = colourLabel(parsed.colour);
    commit(parsed.colour, parsed.alpha ?? undefined);
  }

  function typedLevel(input: HTMLInputElement) {
    const next = alphaOfText(input.value);
    if (next === null) {
      input.value = String(percentOfAlpha(level));
      return;
    }
    commit(base, next);
  }

  function keyLevelField(e: KeyboardEvent) {
    const dir = ARROW[e.key];
    if (e.key === 'Enter') {
      (e.currentTarget as HTMLInputElement).blur();
    }
    if (!dir || !dir[1]) {
      return;
    }
    e.preventDefault();
    commit(base, nudge(percentOfAlpha(level), dir[1] * (e.shiftKey ? BIG_STEP : STEP), HUNDRED) / HUNDRED);
  }

  async function sample() {
    if (!dropper) {
      return;
    }
    try {
      commit((await new dropper().open()).sRGBHex.toLowerCase());
    } catch {
      return;
    }
  }

  function keepFocus(node: HTMLElement) {
    const hold = (e: MouseEvent) => {
      if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault();
      }
    };
    node.addEventListener('mousedown', hold);
    return { destroy: () => node.removeEventListener('mousedown', hold) };
  }

  const pure = $derived(hexOfHsb({ h: hsb.h, s: HUNDRED, b: HUNDRED }));
  const rows = $derived(
    [
      { head: 'Document', colours: swatches },
      { head: 'Brand', colours: BRAND },
      { head: 'Recent', colours: recent }
    ].filter((r) => r.colours.length)
  );
</script>

<div class="picker" data-testid="colour-picker" role="group" aria-label={`${name} picker`} use:keepFocus>
  <div
    class="square"
    role="slider"
    tabindex="0"
    aria-label="Saturation and brightness"
    aria-valuetext={`Saturation ${Math.round(hsb.s)}, brightness ${Math.round(hsb.b)}`}
    aria-valuenow={Math.round(hsb.s)}
    data-testid="colour-square"
    style={`--hue: ${pure};`}
    onpointerdown={dragSquare}
    onkeydown={keySquare}
  >
    <span class="thumb" style={`left: ${hsb.s}%; top: ${HUNDRED - hsb.b}%; --c: ${base};`}></span>
  </div>

  <div class="sliders">
    {#if dropper}<IconButton action={Action.SampleColour} size={14} onclick={sample} data-testid="colour-eyedropper" />{/if}
    <div class="tracks">
      <div class="track hue" role="slider" tabindex="0" aria-label="Hue" aria-valuemin="0" aria-valuemax={TURN} aria-valuenow={Math.round(hsb.h)} data-testid="colour-hue" onpointerdown={dragHue} onkeydown={keyHue}>
        <span class="thumb small" style={`left: ${(hsb.h / TURN) * HUNDRED}%; --c: ${pure};`}></span>
      </div>
      {#if alpha !== null}
        <div class="track level" role="slider" tabindex="0" aria-label="Opacity" aria-valuemin="0" aria-valuemax={HUNDRED} aria-valuenow={percentOfAlpha(level)} data-testid="colour-alpha" style={`--c: ${base};`} onpointerdown={dragLevel} onkeydown={keyLevel}>
          <span class="thumb small" style={`left: ${level * HUNDRED}%; --c: ${base};`}></span>
        </div>
      {/if}
    </div>
  </div>

  <div class="values">
    <select class="format" aria-label="Colour format" data-testid="colour-format" value={format} onchange={(e) => (format = e.currentTarget.value as ColourFormat)}>
      {#each COLOUR_FORMATS as f (f)}<option value={f}>{FORMAT_LABEL[f]}</option>{/each}
    </select>
    <div class="channels" data-format={format}>
      {#if format === ColourFormat.Hex}
        <input type="text" spellcheck="false" aria-label={`${name} hex`} data-testid="colour-channel" value={String(channels[0])} onchange={(e) => typedHex(e.currentTarget)} onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
      {:else}
        {#each channels as channel, i (`${format}-${i}`)}
          <input type="text" inputmode="numeric" spellcheck="false" aria-label={`${name} ${CHANNEL_NAMES[format][i]}`} data-testid="colour-channel" value={String(channel)} onchange={(e) => setChannel(i, e.currentTarget.value)} onkeydown={(e) => keyChannel(e, i)} />
        {/each}
      {/if}
    </div>
    {#if alpha !== null}
      <input class="level-field" type="text" inputmode="numeric" aria-label={`${name} opacity`} data-testid="colour-opacity" value={`${percentOfAlpha(level)}%`} onchange={(e) => typedLevel(e.currentTarget)} onkeydown={keyLevelField} />
    {/if}
  </div>

  {#each rows as row (row.head)}
    <span class="row-head">{row.head}</span>
    <div class="row">
      {#each row.colours as colour (colour)}
        <button type="button" class="swatch" class:on={value.toLowerCase() === colour.toLowerCase()} style={`--c: ${resolveColor(colour, tokens)};`} title={colourLabel(colour)} aria-label={colourLabel(colour)} onclick={() => commit(colour)}></button>
      {/each}
    </div>
  {/each}
</div>

<style>
  .picker {
    display: grid;
    gap: 8px;
    width: 100%;
    min-width: 0;
  }

  .square {
    position: relative;
    aspect-ratio: 5 / 3;
    border-radius: var(--ui-radius-sm);
    background:
      linear-gradient(to top, #000, transparent),
      linear-gradient(to right, #fff, var(--hue));
    cursor: crosshair;
    touch-action: none;
    outline: none;
  }

  .thumb {
    position: absolute;
    width: 12px;
    height: 12px;
    border: 2px solid #fff;
    border-radius: var(--ui-radius-full, 9999px);
    background: var(--c);
    box-shadow: 0 0 0 1px rgb(0 0 0 / 0.35), 0 1px 3px rgb(0 0 0 / 0.4);
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  .thumb.small {
    top: 50%;
  }

  .square:focus-visible,
  .track:focus-visible {
    box-shadow: var(--ui-focus);
  }

  .sliders {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .tracks {
    display: grid;
    flex: 1;
    gap: 8px;
    min-width: 0;
  }

  .track {
    position: relative;
    height: 10px;
    border-radius: var(--ui-radius-full, 9999px);
    cursor: pointer;
    touch-action: none;
    outline: none;
  }

  .hue {
    background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  }

  .level {
    background:
      linear-gradient(to right, transparent, var(--c)),
      conic-gradient(#d9d9d9 25%, #fff 0 50%, #d9d9d9 0 75%, #fff 0) 0 0 / 8px 8px;
  }

  .values {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr) auto;
    gap: 4px;
  }

  .format,
  .channels input,
  .level-field {
    height: var(--ui-row);
    min-width: 0;
    padding: 0 6px;
    border: 1px solid transparent;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-ink);
    font: inherit;
    font-size: var(--ui-text-xs);
    font-variant-numeric: tabular-nums;
    outline: none;
  }

  .format:hover,
  .channels input:hover,
  .level-field:hover {
    border-color: var(--ui-line-strong);
  }

  .format:focus-visible,
  .channels input:focus,
  .level-field:focus {
    border-color: var(--ui-accent);
  }

  .channels {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 4px;
  }

  .level-field {
    width: 44px;
    text-align: right;
  }

  .row-head {
    color: var(--ui-ink-3);
    font-size: 10px;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .swatch {
    width: 18px;
    height: 18px;
    padding: 0;
    border: 1px solid var(--ui-line-strong);
    border-radius: var(--ui-radius-xs);
    background: var(--c);
    cursor: pointer;
  }

  .swatch.on {
    outline: 2px solid var(--ui-accent);
    outline-offset: 1px;
  }

  @media (pointer: coarse) {
    .format,
    .channels input,
    .level-field {
      height: 44px;
    }

    .swatch {
      width: 28px;
      height: 28px;
    }

    .track {
      height: 16px;
    }
  }
</style>
