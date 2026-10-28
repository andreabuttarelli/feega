<script lang="ts">
  import { untrack } from 'svelte';
  import { ColourDisplay, colourLabel } from '$lib/motion/colour-field';
  import { FEEGA_TOKENS, resolveColor, type BrandTokens } from '@feega/motion-core/motion/brand';
  import { parseColour } from '$lib/motion/colour-field';
  import type { LiveGesture } from '$lib/motion/live-edit';
  import { sidePlacement, SideMode, type SidePlace } from '$lib/components/ui/shell/side-popover';
  import ColorPicker from './ColorPicker.svelte';

  const NO_COLOURS = () => [];

  let {
    id,
    name,
    value,
    tokens = FEEGA_TOKENS,
    alpha = null,
    gesture = null,
    palette = NO_COLOURS,
    display = ColourDisplay.Field,
    onchange,
    onalpha
  }: { id?: string; gesture?: LiveGesture | null; name: string; value: unknown; tokens?: BrandTokens; alpha?: number | null; palette?: () => readonly string[]; display?: ColourDisplay; onchange: (value: string, alpha?: number) => void; onalpha?: (alpha: number) => void } = $props();

  const PERCENT = 100;
  const EDGE_SELECTOR = '[data-side-edge]';

  let open = $state(false);
  let root = $state<HTMLDivElement | null>(null);
  let pop = $state<HTMLDivElement | null>(null);
  let height = $state(0);
  let place = $state<SidePlace | null>(null);

  let swatches = $state<readonly string[]>([]);
  const raw = $derived(typeof value === 'string' ? value : '');
  const shown = $derived(resolveColor(raw || undefined, tokens));
  const hasAlpha = $derived(alpha !== null || !!onalpha);

  function measure() {
    if (!root) {
      return;
    }
    const row = root.getBoundingClientRect();
    const edge = (root.closest(EDGE_SELECTOR) ?? root).getBoundingClientRect().left;
    place = sidePlacement({ row, edge, height, viewport: { width: window.innerWidth, height: window.innerHeight } });
  }

  $effect(() => {
    if (open) {
      swatches = untrack(palette);
    }
  });

  $effect(() => {
    if (open) {
      void height;
      measure();
    }
  });

  function pick(next: string, nextAlpha?: number) {
    if (nextAlpha !== undefined && onalpha) {
      onalpha(nextAlpha);
      return;
    }
    onchange(next, nextAlpha);
  }

  function typed(input: HTMLInputElement) {
    const parsed = parseColour(input.value);
    if (parsed === null) {
      input.value = colourLabel(raw);
      return;
    }
    input.value = colourLabel(parsed.colour);
    onchange(parsed.colour, parsed.alpha ?? undefined);
  }

  function setAlpha(text: string) {
    const n = Number(text.replace('%', ''));
    if (Number.isFinite(n)) {
      onalpha?.(Math.min(1, Math.max(0, n / PERCENT)));
    }
  }

  function closeOutside(e: PointerEvent) {
    const target = e.target as Node;
    if (open && root && !root.contains(target) && !pop?.contains(target)) {
      gesture?.release();
      open = false;
    }
  }

  function closeOnEscape(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      gesture?.cancel();
      open = false;
    }
  }

  const style = $derived(place?.mode === SideMode.Side ? `left:${place.left}px;top:${place.top}px;width:${place.width}px` : '');
</script>

<svelte:window onpointerdown={closeOutside} onresize={measure} />

<div class="colour" data-display={display} bind:this={root} data-colour={name} role="group" aria-label={name} onkeydown={closeOnEscape}>
  <button type="button" class="chip" style={`--c: ${shown};`} aria-label={`Pick ${name}`} aria-expanded={open} onclick={() => (open = !open)}></button>
  {#if display === ColourDisplay.Field}<input {id} class="hex" type="text" spellcheck="false" aria-label={name} value={colourLabel(raw)} onchange={(e) => typed(e.currentTarget)} onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />{/if}
  {#if onalpha && display === ColourDisplay.Field}<input class="alpha" type="text" inputmode="decimal" aria-label={`${name} opacity`} value={`${Math.round((alpha ?? 1) * PERCENT)}%`} onchange={(e) => setAlpha(e.currentTarget.value)} />{/if}
  {#if open}
    <div bind:this={pop} bind:offsetHeight={height} class="pop" data-mode={place?.mode ?? SideMode.Side} role="dialog" aria-label={`${name} colours`} data-testid="colour-popover" {style}>
      <ColorPicker {name} value={raw} {tokens} alpha={hasAlpha ? (alpha ?? 1) : null} {swatches} {gesture} onchange={pick} />
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

  .colour[data-display='chip'] {
    display: inline-flex;
    width: auto;
    height: auto;
    padding: 0;
    background: none;
    border: 0;
  }

  .colour[data-display='chip'] .chip {
    width: 24px;
    height: 24px;
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

  .pop {
    position: fixed;
    z-index: 70;
    box-sizing: border-box;
    max-height: calc(100vh - 16px);
    overflow: auto;
    padding: 8px;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-panel-raised);
    box-shadow: var(--ui-shadow-float);
  }

  .pop[data-mode='sheet'] {
    inset: auto 0 0;
    max-height: 70vh;
    border-radius: var(--ui-radius-lg) var(--ui-radius-lg) 0 0;
  }

  @media (pointer: coarse) {
    .colour {
      height: 44px;
    }

    .chip {
      width: 28px;
      height: 28px;
    }
  }
</style>
