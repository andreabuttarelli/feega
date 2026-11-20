<script lang="ts">
  import { Popover } from 'bits-ui';
  import type { ColourPick, Palette } from '../messages';
  import ColorPicker from './ColorPicker.svelte';

  type Props = { value: string; palette: Palette; label: string; onchange: (pick: ColourPick) => void; onpreview?: (css: string) => void };

  let { value, palette, label, onchange, onpreview }: Props = $props();
</script>

<Popover.Root>
  <Popover.Trigger class="colour-swatch" aria-label={label} title={label}>
    <span style={`background: ${value}`}></span>
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content class="fill-popover" side="left" sideOffset={8} collisionPadding={8}>
      <ColorPicker {value} {palette} {onchange} {onpreview} />
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>

<style>
  :global(.colour-swatch) {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    padding: 0;
    border: 1px solid var(--line, rgb(128 128 128 / 0.4));
    border-radius: 2px;
    background: repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 8px 8px;
    cursor: pointer;
  }

  :global(.colour-swatch span) {
    width: 100%;
    height: 100%;
    border-radius: 1px;
  }
</style>
