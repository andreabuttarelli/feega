<script lang="ts">
  import { Notch, type DeviceFrame } from './sizes';

  type Props = { frame: DeviceFrame; scale: number; landscape: boolean };

  let { frame, scale, landscape }: Props = $props();

  const CLOCK = '9:41';
  const ISLAND_ROW_PX = 56;

  const px = (n: number) => `${n * scale}px`;
  const { insets } = $derived(frame);
  const statusRow = $derived(frame.notch === Notch.Island ? ISLAND_ROW_PX : insets.top);
</script>

<div class="chrome" style={`--scale:${scale}`} data-testid="device-chrome" aria-hidden="true">
  {#if insets.top}
    <div class="band" style={`top:0;left:0;right:0;height:${px(insets.top)}`}>
      <div class="status" class:island={frame.notch === Notch.Island} style={`height:${px(statusRow)}`}>
        <span class="clock">{CLOCK}</span>
        <span class="glyphs">
          <svg viewBox="0 0 18 12" fill="currentColor"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5" width="3" height="7" rx="1" /><rect x="10" y="2.5" width="3" height="9.5" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
          <svg viewBox="0 0 16 12" fill="currentColor"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0zM2.9 6.3a7.2 7.2 0 0 1 10.2 0l-1.4 1.4a5.2 5.2 0 0 0-7.4 0zM.6 4A10.4 10.4 0 0 1 15.4 4L14 5.4a8.4 8.4 0 0 0-12 0z" /></svg>
          <svg viewBox="0 0 27 12" fill="none"><rect x="0.5" y="0.5" width="22" height="11" rx="3.2" stroke="currentColor" opacity="0.4" /><rect x="2" y="2" width="19" height="8" rx="2" fill="currentColor" /><rect x="24" y="4" width="2" height="4" rx="1" fill="currentColor" opacity="0.4" /></svg>
        </span>
      </div>
    </div>
  {/if}
  {#if insets.bottom}
    <div class="band" style={`bottom:0;left:0;right:0;height:${px(insets.bottom)}`}>
      <div class="home" style={`bottom:${px(Math.min(8, insets.bottom / 2))}`}></div>
    </div>
  {/if}
  {#if insets.left}<div class="band" style={`left:0;top:0;bottom:0;width:${px(insets.left)}`}></div>{/if}
  {#if insets.right}<div class="band" style={`right:0;top:0;bottom:0;width:${px(insets.right)}`}></div>{/if}
  {#if frame.notch !== Notch.None}
    <div class={`notch ${frame.notch}`} class:landscape data-testid="device-notch"></div>
  {/if}
</div>

<style>
  .chrome {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
  }

  .band {
    position: absolute;
    background: #111;
    color: #fff;
  }

  .status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 calc(28px * var(--scale));
    font: 600 calc(15px * var(--scale)) / 1 -apple-system, system-ui, sans-serif;
    font-variant-numeric: tabular-nums;
  }

  .status.island {
    padding: 0 calc(34px * var(--scale)) 0 calc(48px * var(--scale));
  }

  .glyphs {
    display: flex;
    align-items: center;
    gap: calc(5px * var(--scale));
  }

  .glyphs svg {
    height: calc(12px * var(--scale));
  }

  .home {
    position: absolute;
    left: 50%;
    width: calc(134px * var(--scale));
    height: calc(5px * var(--scale));
    border-radius: 999px;
    background: #fff;
    transform: translateX(-50%);
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
