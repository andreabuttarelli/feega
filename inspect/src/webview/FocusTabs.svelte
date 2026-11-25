<script lang="ts">
  import ComponentIcon from '@lucide/svelte/icons/component';
  import Grid from '@lucide/svelte/icons/grid-2x2';
  import House from '@lucide/svelte/icons/house';
  import Minus from '@lucide/svelte/icons/minus';
  import Moon from '@lucide/svelte/icons/moon';
  import Plus from '@lucide/svelte/icons/plus';
  import Scan from '@lucide/svelte/icons/scan';
  import Sun from '@lucide/svelte/icons/sun';
  import X from '@lucide/svelte/icons/x';
  import { REAL_SIZE, Scheme, View } from './focus';
  import type { ZoomRequest } from './page-bridge';

  type Props = {
    name: string;
    active: View;
    onselect: (view: View) => void;
    onclose: () => void;
    notice?: string | null;
    scheme: Scheme;
    onscheme: (scheme: Scheme) => void;
    transparent?: boolean;
    ontransparent?: () => void;
    zoom?: number;
    onzoom?: (request: ZoomRequest) => void;
    onstep?: (direction: 1 | -1) => void;
    height?: number;
  };

  let { name, active, onselect, onclose, notice = null, scheme, onscheme, transparent = false, ontransparent = () => undefined, zoom = REAL_SIZE, onzoom = () => undefined, onstep = () => undefined, height = $bindable(0) }: Props = $props();

  const percent = $derived(`${Math.round(zoom * 100)}%`);
</script>

<div class="tabs" role="tablist" data-testid="focus-tabs" bind:clientHeight={height}>
  <button type="button" role="tab" aria-selected={active === View.Page} class:on={active === View.Page} data-testid="tab-page" onclick={() => onselect(View.Page)}><House size={14} />Page</button>
  <span class="tab" class:on={active === View.Focus}>
    <button type="button" role="tab" aria-selected={active === View.Focus} data-testid="tab-focus" onclick={() => onselect(View.Focus)}><ComponentIcon size={14} />{name}</button>
    <button type="button" class="close" data-testid="focus-exit" title="Close (Esc)" aria-label="Close {name}" onclick={onclose}><X size={14} /></button>
  </span>
  {#if notice}<span class="notice" data-testid="focus-notice">{notice}</span>{/if}
  <span class="tools" class:push={!notice}>
    {#if active === View.Focus}
      <span class="zoom" data-testid="focus-zoom">
        <button type="button" data-testid="zoom-fit" title="Fit to the canvas" aria-label="Fit to the canvas" onclick={() => onzoom({ mode: 'fit' })}><Scan size={14} /></button>
        <button type="button" data-testid="zoom-out" title="Zoom out" aria-label="Zoom out" onclick={() => onstep(-1)}><Minus size={14} /></button>
        <button type="button" class="readout" data-testid="zoom-reset" title="Real size" aria-label="Real size" onclick={() => onzoom({ mode: 'set', value: REAL_SIZE })}>{percent}</button>
        <button type="button" data-testid="zoom-in" title="Zoom in" aria-label="Zoom in" onclick={() => onstep(1)}><Plus size={14} /></button>
      </span>
    {/if}
    <button type="button" class="scheme" data-testid="focus-scheme" data-scheme={scheme} title={scheme === Scheme.Dark ? 'Dark: switch to light' : 'Light: switch to dark'} aria-label="Switch between light and dark" onclick={() => onscheme(scheme === Scheme.Dark ? Scheme.Light : Scheme.Dark)}>
      {#if scheme === Scheme.Dark}<Moon size={14} />{:else}<Sun size={14} />{/if}
    </button>
    <button type="button" class="scheme" class:on={transparent} aria-pressed={transparent} data-testid="focus-transparent" title="Show a transparent checkerboard behind the component" aria-label="Transparent canvas" onclick={ontransparent}><Grid size={14} /></button>
  </span>
</div>

<style>
  .tabs {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    padding: 4px 8px 0;
    background: var(--ui-chrome, var(--ui-float));
    box-shadow: inset 0 -1px 0 var(--ui-divider);
    font-size: var(--ui-text-xs);
  }

  button {
    border: 0;
    background: transparent;
    color: var(--ui-text-muted, inherit);
    font: inherit;
    cursor: default;
  }

  .tabs > button,
  .tab {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 26px;
    padding: 0 10px;
    border-radius: var(--ui-radius-md) var(--ui-radius-md) 0 0;
  }

  .tab {
    gap: 4px;
    padding-right: 4px;
  }

  .tab > button:first-child {
    display: flex;
    align-items: center;
    gap: 5px;
    height: 100%;
    padding: 0;
    font-weight: 600;
  }

  .on {
    background: var(--ui-bg, var(--ui-float));
    color: var(--ui-text);
    box-shadow: inset 0 0 0 1px var(--ui-divider), 0 1px 0 var(--ui-bg, var(--ui-float));
  }

  .close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: var(--ui-radius-sm, 4px);
    color: inherit;
  }

  .notice {
    align-self: center;
    margin-left: auto;
    padding-bottom: 4px;
    color: var(--ui-text-muted, inherit);
  }

  .tools {
    display: flex;
    align-items: center;
    align-self: center;
    gap: 2px;
    margin-bottom: 4px;
    margin-left: 6px;
  }

  .tools.push {
    margin-left: auto;
  }

  .zoom {
    display: flex;
    align-items: center;
    margin-right: 6px;
  }

  .zoom button,
  .scheme {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 4px;
    border-radius: var(--ui-radius-sm, 4px);
    color: var(--ui-text);
  }

  .readout {
    min-width: 44px;
    font-variant-numeric: tabular-nums;
  }

  .scheme.on {
    background: var(--ui-input);
  }

  .zoom button:hover,
  .scheme:hover,
  .close:hover {
    background: var(--ui-divider);
  }
</style>
