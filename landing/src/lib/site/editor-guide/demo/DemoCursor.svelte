<script lang="ts">
  import type { Point } from './script';

  type Props = { at: Point; pressed: boolean; ring: number | undefined };

  let { at, pressed, ring }: Props = $props();
</script>

<div class="cursor" style:transform="translate({at.x}px, {at.y}px)" aria-hidden="true">
  {#if ring !== undefined}
    <i class="ring" style:opacity={1 - ring} style:transform="translate(-50%, -50%) scale({0.4 + ring * 0.8})"></i>
  {/if}
  <svg class="arrow" class:pressed width="16" height="22" viewBox="0 0 16 22">
    <path d="M1 1 V17.5 L5.2 13.7 L8 20 L10.7 18.8 L7.9 12.6 H13.5 Z" fill="#000000" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round" />
  </svg>
</div>

<style>
  .cursor {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 5;
    width: 0;
    height: 0;
    pointer-events: none;
    will-change: transform;
  }

  .arrow {
    position: absolute;
    top: -1px;
    left: -1px;
    overflow: visible;
    filter: drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.45));
    transform-origin: 1px 1px;
    transition: transform 0.12s cubic-bezier(0.87, 0, 0.13, 1);
  }

  .arrow.pressed {
    transform: scale(0.88);
  }

  .ring {
    position: absolute;
    top: 0;
    left: 0;
    width: 26px;
    height: 26px;
    border: 1.5px solid rgb(255 255 255 / 0.85);
    border-radius: 50%;
  }
</style>
