<script lang="ts">
  import type { Component } from 'svelte';

  let { icon: Icon, size = 24, strokeWidth = 2, ...rest }: { icon: Component<Record<string, unknown>>; size?: number | string; strokeWidth?: number | string; [key: string]: unknown } = $props();
</script>

<span class="generate" style:width={`${size}px`} style:height={`${size}px`} data-generate>
  <Icon {size} {strokeWidth} {...rest} />
  <svg class="plus" viewBox="0 0 10 10" width={Number(size) * 0.5} height={Number(size) * 0.5} aria-hidden="true">
    <circle cx="5" cy="5" r="5" fill="currentColor" />
    <path d="M5 2.6v4.8M2.6 5h4.8" stroke="var(--ui-panel-raised, #fff)" stroke-width="1.4" stroke-linecap="round" />
  </svg>
</span>

<style>
  .generate {
    position: relative;
    display: inline-flex;
    flex: none;
  }

  .plus {
    position: absolute;
    right: -2px;
    bottom: -2px;
  }
</style>
