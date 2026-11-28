<script lang="ts">
  import Puzzle from '@lucide/svelte/icons/puzzle';
  import Pixel from '@feega/pixel-icons/Pixel.svelte';
  import type { PixelIcon } from '@feega/pixel-icons/pixel';

  const CELL = 2;

  let { icon }: { icon: PixelIcon | undefined } = $props();
</script>

<span class="glyph" data-testid="plugin-glyph" data-icon={icon ?? 'fallback'}>
  {#if icon}<Pixel {icon} size={CELL} />{:else}<Puzzle size={16} />{/if}
</span>

<style>
  .glyph {
    display: grid;
    flex: none;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: var(--ui-radius-md, 8px);
    background: color-mix(in srgb, var(--ui-accent, currentColor) 10%, var(--ui-panel));
    color: var(--ui-text-2);
  }
</style>
