<script lang="ts">
  import Grid from '@lucide/svelte/icons/grid-2x2';
  import Info from '@lucide/svelte/icons/info';
  import Minus from '@lucide/svelte/icons/minus';
  import Moon from '@lucide/svelte/icons/moon';
  import Plus from '@lucide/svelte/icons/plus';
  import Scan from '@lucide/svelte/icons/scan';
  import Sun from '@lucide/svelte/icons/sun';
  import { REAL_SIZE, Scheme } from './focus';
  import type { ZoomRequest } from './page-bridge';
  import { FocusControl } from './views';

  type Props = {
    controls: FocusControl[];
    notice?: string | null;
    scheme: Scheme;
    onscheme: (scheme: Scheme) => void;
    transparent?: boolean;
    ontransparent: () => void;
    zoom?: number;
    onzoom: (request: ZoomRequest) => void;
    onstep: (direction: 1 | -1) => void;
  };

  let { controls, notice = null, scheme, onscheme, transparent = false, ontransparent, zoom = REAL_SIZE, onzoom, onstep }: Props = $props();

  const percent = $derived(`${Math.round(zoom * 100)}%`);
</script>

<span class="rule" aria-hidden="true"></span>
{#if notice}<span class="icon notice" role="img" data-testid="focus-notice" title={notice} aria-label={notice}><Info size={14} /></span>{/if}
{#each controls as control (control)}
  {#if control === FocusControl.Zoom}
    <span class="zoom" data-testid="focus-zoom">
      <button type="button" class="icon" data-testid="zoom-fit" title="Fit to the canvas" aria-label="Fit to the canvas" onclick={() => onzoom({ mode: 'fit' })}><Scan size={14} /></button>
      <button type="button" class="icon" data-testid="zoom-out" title="Zoom out" aria-label="Zoom out" onclick={() => onstep(-1)}><Minus size={14} /></button>
      <button type="button" class="icon readout" data-testid="zoom-reset" title="Real size" aria-label="Real size" onclick={() => onzoom({ mode: 'set', value: REAL_SIZE })}>{percent}</button>
      <button type="button" class="icon" data-testid="zoom-in" title="Zoom in" aria-label="Zoom in" onclick={() => onstep(1)}><Plus size={14} /></button>
    </span>
  {:else if control === FocusControl.Scheme}
    <button type="button" class="icon" data-testid="focus-scheme" data-scheme={scheme} title={scheme === Scheme.Dark ? 'Dark: switch to light' : 'Light: switch to dark'} aria-label="Switch between light and dark" onclick={() => onscheme(scheme === Scheme.Dark ? Scheme.Light : Scheme.Dark)}>
      {#if scheme === Scheme.Dark}<Moon size={14} />{:else}<Sun size={14} />{/if}
    </button>
  {:else if control === FocusControl.Transparent}
    <button type="button" class="icon" class:on={transparent} aria-pressed={transparent} data-testid="focus-transparent" title="Show a transparent checkerboard behind the component" aria-label="Transparent canvas" onclick={ontransparent}><Grid size={14} /></button>
  {/if}
{/each}

<style>
  .rule {
    align-self: stretch;
    width: 1px;
    margin: 4px 0;
    background: var(--ui-divider);
  }

  .zoom {
    display: flex;
    align-items: center;
  }

  .icon {
    display: grid;
    place-items: center;
    min-width: 28px;
    height: 28px;
    padding: 0 4px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-2);
    font: inherit;
    font-size: var(--ui-text-xs);
    cursor: pointer;
  }

  .icon:hover,
  .icon.on {
    background: var(--ui-input);
  }

  .notice {
    cursor: default;
  }

  .readout {
    min-width: 44px;
    font-variant-numeric: tabular-nums;
  }
</style>
