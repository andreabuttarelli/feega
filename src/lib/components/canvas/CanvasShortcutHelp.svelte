<script lang="ts">
  import ShortcutHelp from '$lib/components/motion/ShortcutHelp.svelte';
  import { canvasGuide } from '$lib/canvas/shortcuts';
  import { shortcutHelp } from '$lib/canvas/shortcut-help.svelte';

  const MAC = /mac|iphone|ipad/i;
  const mod = typeof navigator !== 'undefined' && MAC.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';

  const close = () => (shortcutHelp.open = false);
</script>

<svelte:window onkeydown={(e) => shortcutHelp.open && e.key === 'Escape' && close()} />

{#if shortcutHelp.open}
  <div class="layer">
    <ShortcutHelp sections={canvasGuide(mod)} onclose={close} />
  </div>
{/if}

<style>
  .layer {
    position: relative;
    z-index: 200;
  }
</style>
