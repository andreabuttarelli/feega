<script lang="ts">
  import type { Snippet } from 'svelte';
  import AsciiField from '../home/AsciiField.svelte';

  let { children }: { children: Snippet } = $props();
</script>

<header class="tpl-hero">
  <div class="bg" aria-hidden="true">
    <AsciiField />
    <div class="scrim"></div>
  </div>
  <div class="copy">{@render children()}</div>
</header>

<style>
  .tpl-hero {
    position: relative;
    min-height: 380px;
    padding-top: 96px;
    padding-bottom: 56px;
  }

  .bg {
    position: absolute;
    top: 0;
    left: 50%;
    z-index: 0;
    width: 100vw;
    height: 100%;
    overflow: hidden;
    transform: translateX(-50%);
    pointer-events: none;
  }

  .scrim {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 70% at 25% 50%, rgb(0 0 0 / 0.5), rgb(0 0 0 / 0) 100%),
      linear-gradient(to bottom, rgb(0 0 0 / 0) 55%, #000 100%);
  }

  .copy {
    position: relative;
    z-index: 1;
  }
</style>
