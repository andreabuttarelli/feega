<script lang="ts">
  import { moveByKey, sliderPercent } from '$lib/canvas/compare-slider';

  const START_PERCENT = 50;

  let { left, right, leftLabel = '', rightLabel = '' }: { left: string; right: string; leftLabel?: string; rightLabel?: string } = $props();

  let percent = $state(START_PERCENT);
  let frame = $state<HTMLDivElement | null>(null);
  let dragging = false;

  function drag(e: PointerEvent) {
    if (!dragging || !frame) {
      return;
    }
    percent = sliderPercent(e.clientX, frame.getBoundingClientRect());
  }

  function press(e: PointerEvent) {
    dragging = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag(e);
  }
</script>

<div class="compare" data-testid="compare-slider" bind:this={frame}>
  <img class="under" src={right} alt={rightLabel} />
  <img class="over" src={left} alt={leftLabel} style={`clip-path: inset(0 ${100 - percent}% 0 0)`} />
  <span class="tag a">{leftLabel}</span>
  <span class="tag b">{rightLabel}</span>
  <div
    class="handle"
    role="slider"
    tabindex="0"
    aria-label="Comparison position"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={Math.round(percent)}
    data-testid="compare-handle"
    style={`left: ${percent}%`}
    onpointerdown={press}
    onpointermove={drag}
    onpointerup={() => (dragging = false)}
    onkeydown={(e) => (percent = moveByKey(percent, e.key))}
  ></div>
</div>

<style>
  .compare {
    position: relative;
    display: inline-block;
    max-width: 100%;
    max-height: 100%;
    line-height: 0;
    user-select: none;
    touch-action: none;
  }

  img {
    display: block;
    max-width: 100%;
    max-height: 80vh;
    object-fit: contain;
  }

  .over {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 3px;
    margin-left: -1px;
    background: #fff;
    cursor: ew-resize;
    box-shadow: 0 0 0 1px rgb(0 0 0 / 0.4);
  }

  .handle::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 24px;
    height: 24px;
    transform: translate(-50%, -50%);
    border: 2px solid #fff;
    border-radius: 9999px;
    background: rgb(0 0 0 / 0.5);
  }

  .tag {
    position: absolute;
    top: 8px;
    padding: 2px 6px;
    border-radius: var(--ui-radius-sm);
    background: rgb(0 0 0 / 0.55);
    color: #fff;
    font-size: var(--ui-text-xs);
    line-height: 1.3;
  }

  .a {
    left: 8px;
  }

  .b {
    right: 8px;
  }
</style>
