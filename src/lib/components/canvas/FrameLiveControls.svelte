<script lang="ts">
  import Play from '@lucide/svelte/icons/play';
  import { frameLive } from '$lib/canvas/frame-live.svelte';
  import { LIVE_MESSAGE, LiveEvent, type LiveMessage } from '$lib/motion/interactive/live-bridge';

  let { nodeId, interactive, src }: { nodeId: string; interactive: boolean; src: string } = $props();

  const live = $derived(frameLive.id === nodeId);
  let frame = $state<HTMLIFrameElement | null>(null);

  const ON_LIVE: Record<LiveEvent, (m: LiveMessage) => void> = {
    [LiveEvent.Escape]: () => frameLive.stop(),
    [LiveEvent.Wheel]: (m) => handWheel(m),
    [LiveEvent.GestureStart]: (m) => handGesture(m),
    [LiveEvent.GestureChange]: (m) => handGesture(m),
    [LiveEvent.GestureEnd]: (m) => handGesture(m)
  };

  function handGesture(m: LiveMessage) {
    const el = frame;
    if (!el?.parentElement) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const scale = rect.width / Math.max(el.offsetWidth, 1);
    const at = { clientX: rect.left + (m.x ?? 0) * scale, clientY: rect.top + (m.y ?? 0) * scale, scale: m.scale ?? 1 };
    el.parentElement.dispatchEvent(Object.assign(new Event(m.event, { bubbles: true, cancelable: true }), at));
  }

  function handWheel(m: LiveMessage) {
    const el = frame;
    if (!el?.parentElement) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const scale = rect.width / Math.max(el.offsetWidth, 1);
    const at = { clientX: rect.left + (m.x ?? 0) * scale, clientY: rect.top + (m.y ?? 0) * scale };
    el.parentElement.dispatchEvent(new WheelEvent('wheel', { ...at, deltaX: m.dx ?? 0, deltaY: m.dy ?? 0, ctrlKey: m.ctrl ?? false, bubbles: true, cancelable: true }));
  }

  $effect(() => {
    if (!live) {
      return;
    }
    const heard = (e: MessageEvent) => {
      const m = e.data as LiveMessage | null;
      if (e.source !== frame?.contentWindow || m?.type !== LIVE_MESSAGE) {
        return;
      }
      ON_LIVE[m.event]?.(m);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        frameLive.stop();
      }
    };
    addEventListener('message', heard);
    addEventListener('keydown', escape);
    return () => {
      removeEventListener('message', heard);
      removeEventListener('keydown', escape);
    };
  });

  function hold(e: Event) {
    e.stopPropagation();
  }
</script>

{#if interactive}
  <div class="live-switch nodrag nopan" data-testid="frame-live-switch" data-live={live} role="presentation" onpointerdown={hold} onclick={hold} ondblclick={hold}>
    <Play size={11} strokeWidth={2} />
    <span>Play</span>
    <button type="button" class="toggle" role="switch" aria-checked={live} aria-label="Play this frame live on the canvas" data-testid="frame-live-toggle" onclick={() => frameLive.toggle(nodeId)}><span class="knob"></span></button>
  </div>
  {#if live}
    <iframe bind:this={frame} class="live-frame nodrag nopan nowheel" data-testid="frame-live" title="Interactive frame" {src} sandbox="allow-scripts" allow="accelerometer; gyroscope"></iframe>
  {/if}
{/if}

<style>
  .live-switch {
    position: absolute;
    z-index: 6;
    bottom: 100%;
    right: 0;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: var(--canvas-label-size, 12px);
    line-height: 1.3;
    color: var(--ink-soft, #6e6e73);
    pointer-events: auto;
  }

  .live-switch[data-live='true'] {
    color: var(--ink, #1d1d1f);
  }

  .toggle {
    position: relative;
    width: 24px;
    height: 14px;
    padding: 0;
    border: 0;
    border-radius: 9999px;
    background: var(--ui-line, #d2d2d7);
    cursor: pointer;
  }

  .toggle[aria-checked='true'] {
    background: var(--ui-accent, #0a84ff);
  }

  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 10px;
    height: 10px;
    border-radius: 9999px;
    background: #fff;
    transition: transform 160ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .toggle[aria-checked='true'] .knob {
    transform: translateX(10px);
  }

  .live-frame {
    position: absolute;
    z-index: 5;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
    background: transparent;
    pointer-events: auto;
  }
</style>
