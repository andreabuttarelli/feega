<script lang="ts">
  import { Notch, type DeviceFrame } from './sizes';

  type Props = { frame: DeviceFrame; scale: number; landscape: boolean };

  let { frame, scale, landscape }: Props = $props();

  const px = (n: number) => `${n * scale}px`;
  const { insets } = $derived(frame);
</script>

<div class="chrome" data-testid="device-chrome" aria-hidden="true">
  {#if insets.top}<div class="inset" style={`top:0;left:0;right:0;height:${px(insets.top)}`}></div>{/if}
  {#if insets.bottom}<div class="inset" style={`bottom:0;left:0;right:0;height:${px(insets.bottom)}`}></div>{/if}
  {#if insets.left}<div class="inset" style={`left:0;top:0;bottom:0;width:${px(insets.left)}`}></div>{/if}
  {#if insets.right}<div class="inset" style={`right:0;top:0;bottom:0;width:${px(insets.right)}`}></div>{/if}
  {#if frame.notch !== Notch.None}
    <div class={`notch ${frame.notch}`} class:landscape style={`--scale:${scale}`} data-testid="device-notch"></div>
  {/if}
</div>

<style>
  .chrome {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
  }

  .inset {
    position: absolute;
    background: repeating-linear-gradient(135deg, rgb(0 0 0 / 0.06) 0 4px, transparent 4px 8px);
  }

  .notch {
    position: absolute;
    top: calc(11px * var(--scale));
    left: 50%;
    width: calc(120px * var(--scale));
    height: calc(34px * var(--scale));
    border-radius: 999px;
    background: #000;
    transform: translateX(-50%);
  }

  .notch.punch {
    top: calc(12px * var(--scale));
    width: calc(14px * var(--scale));
    height: calc(14px * var(--scale));
  }

  .notch.landscape {
    top: 50%;
    left: calc(11px * var(--scale));
    width: calc(34px * var(--scale));
    height: calc(120px * var(--scale));
    transform: translateY(-50%);
  }

  .notch.punch.landscape {
    left: calc(12px * var(--scale));
    width: calc(14px * var(--scale));
    height: calc(14px * var(--scale));
  }
</style>
