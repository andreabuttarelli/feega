<script lang="ts">
  import { onMount } from 'svelte';
  import { BRAND_COLORS } from '$lib/motion/components';
  import { resolveColor, type BrandTokens } from '$lib/motion/brand';
  import { colourLabel, parseColour, readRecent, remember } from '$lib/motion/colour-field';
  import type { LayoutStore } from '$lib/motion/editor-layout';

  let { id, name, value, tokens, onchange }: { id?: string; name: string; value: unknown; tokens: BrandTokens; onchange: (value: string) => void } = $props();

  const HEX = /^#[0-9a-f]{6}$/i;
  const NONE = '#000000';

  let open = $state(false);
  let recent = $state<string[]>([]);
  let root = $state<HTMLDivElement | null>(null);

  const raw = $derived(typeof value === 'string' ? value : '');
  const shown = $derived(resolveColor(raw || undefined, tokens));
  const pickerValue = $derived(HEX.test(shown) ? shown : NONE);

  function store(): LayoutStore | null {
    try {
      return localStorage;
    } catch {
      return null;
    }
  }

  onMount(() => {
    recent = readRecent(store());
  });

  function pick(next: string) {
    if (HEX.test(next)) {
      recent = remember(recent, next.toLowerCase(), store());
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
  {#if open}
    <div class="pop" role="dialog" aria-label={`${name} colours`} data-testid="colour-popover">
      <input class="wheel" type="color" aria-label={`${name} picker`} value={pickerValue} onchange={(e) => pick(e.currentTarget.value)} />
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
    height: 28px;
    min-width: 0;
    padding: 0 6px;
    background: var(--ui-field);
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
    border-radius: 0;
    background: var(--c);
    cursor: pointer;
  }

  .hex {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--ui-ink);
    font: inherit;
    font-size: var(--ui-text-xs);
    font-variant-numeric: tabular-nums;
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
    background: var(--ui-bg);
    border: 1px solid var(--ui-line-strong);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.12);
  }

  .wheel {
    width: 100%;
    height: 96px;
    padding: 0;
    border: 0;
    border-radius: 0;
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
    border-radius: 0;
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
