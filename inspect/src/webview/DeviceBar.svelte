<script lang="ts">
  import { DropdownMenu } from 'bits-ui';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Laptop from '@lucide/svelte/icons/laptop';
  import Maximize from '@lucide/svelte/icons/maximize-2';
  import Monitor from '@lucide/svelte/icons/monitor';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw-square';
  import Smartphone from '@lucide/svelte/icons/smartphone';
  import Tablet from '@lucide/svelte/icons/tablet';
  import type { Component } from 'svelte';
  import { DEVICE_MENU, SIZES, Size, rotated, type Fit } from './sizes';

  type Props = { size: Size; fit: Fit; onsize: (size: Size) => void; onwidth: (width: number) => void };

  let { size, fit, onsize, onwidth }: Props = $props();

  const ICONS: Record<Size, Component> = {
    [Size.Full]: Maximize,
    [Size.Desktop]: Monitor,
    [Size.Laptop]: Laptop,
    [Size.TabletLandscape]: Tablet,
    [Size.Tablet]: Tablet,
    [Size.PhoneLarge]: Smartphone,
    [Size.Phone]: Smartphone,
    [Size.PhoneSmall]: Smartphone,
    [Size.Iphone15]: Smartphone,
    [Size.Iphone15Landscape]: Smartphone,
    [Size.IphoneSe]: Smartphone,
    [Size.IphoneSeLandscape]: Smartphone,
    [Size.Pixel8]: Smartphone,
    [Size.Pixel8Landscape]: Smartphone,
    [Size.Ipad]: Tablet,
    [Size.IpadLandscape]: Tablet,
    [Size.Custom]: Maximize
  };

  const SEGMENTS = [Size.Full, Size.Desktop, Size.Tablet, Size.Phone];
  const GROUPS: { label: string; sizes: Size[] }[] = [
    { label: 'Desktop', sizes: [Size.Full, Size.Desktop, Size.Laptop] },
    { label: 'Tablet', sizes: [Size.Tablet, Size.TabletLandscape] },
    { label: 'Phone', sizes: [Size.PhoneLarge, Size.Phone, Size.PhoneSmall] },
    { label: 'Device frames', sizes: DEVICE_MENU }
  ];

  const dims = (s: Size) => (SIZES[s].width ? `${SIZES[s].width} × ${SIZES[s].height}` : 'fits the panel');
  const tip = (s: Size) => `${SIZES[s].label} · ${dims(s)}${SIZES[s].key ? ` (${SIZES[s].key})` : ''}`;
  const turn = $derived(rotated(size));
</script>

<div class="devices" data-testid="device">
  <div class="segments" role="radiogroup" aria-label="Device">
    {#each SEGMENTS as s (s)}
      {@const Icon = ICONS[s]}
      <button type="button" role="radio" aria-checked={size === s} class:on={size === s} title={tip(s)} aria-label={SIZES[s].label} onclick={() => onsize(s)}><Icon size={14} /></button>
    {/each}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger class="more" aria-label="All sizes" title="All sizes"><ChevronDown size={12} /></DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="dropdown-menu" sideOffset={4} align="end">
          {#each GROUPS as group, g (group.label)}
            {#if g}<DropdownMenu.Separator class="dropdown-sep" />{/if}
            <DropdownMenu.Group>
              <DropdownMenu.GroupHeading class="dropdown-heading">{group.label}</DropdownMenu.GroupHeading>
              {#each group.sizes as s (s)}
                {@const Icon = ICONS[s]}
                <DropdownMenu.Item class="dropdown-item device-row" onSelect={() => onsize(s)}>
                  <Icon size={13} /><span>{SIZES[s].label}</span><span class="dims">{dims(s)}</span>
                </DropdownMenu.Item>
              {/each}
            </DropdownMenu.Group>
          {/each}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  </div>
  <label class="readout field" title="Width × height">
    <input type="number" style={`width:${String(fit.width).length + 1}ch`} value={fit.width} aria-label="Width" onchange={(e) => onwidth(Number(e.currentTarget.value))} />
    <span>×</span>
    <span class="height">{fit.height}</span>
  </label>
  {#if turn}<button type="button" class="rotate" title="Rotate" aria-label="Rotate" onclick={() => onsize(turn)}><RotateCcw size={14} /></button>{/if}
</div>

<style>
  .devices {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .segments {
    display: flex;
    align-items: center;
    padding: 2px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
  }

  .segments button,
  .segments :global(.more),
  .rotate {
    display: grid;
    place-items: center;
    width: 24px;
    height: 20px;
    padding: 0;
    border: 0;
    border-radius: var(--ui-radius-xs);
    background: none;
    color: var(--ui-text-2);
    cursor: pointer;
  }

  .segments :global(.more) {
    width: 16px;
  }

  .segments button.on {
    background: var(--ui-float);
    color: var(--ui-text);
    box-shadow: 0 0 0 1px var(--ui-divider);
  }

  .segments button:hover:not(.on),
  .segments :global(.more:hover),
  .rotate:hover {
    color: var(--ui-text);
  }

  .readout {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 24px;
    padding: 0 6px;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text-2);
    font-size: var(--ui-text-sm);
    font-variant-numeric: tabular-nums;
  }

  .readout input {
    padding: 0;
    color: var(--ui-text);
    font: inherit;
  }

  .height {
    min-width: 32px;
  }

  :global(.device-row) {
    display: grid !important;
    grid-template-columns: 16px 1fr auto;
    gap: 8px;
    align-items: center;
  }

  :global(.device-row .dims),
  :global(.dropdown-heading) {
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }

  :global(.dropdown-heading) {
    padding: 4px 8px 2px;
  }
</style>
