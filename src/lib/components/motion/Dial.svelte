<script lang="ts">
  const SIZE = 34;
  const SNAP_DEG = 15;

  let { value, label, onchange }: { value: number; label: string; onchange: (value: number) => void } = $props();

  let box = $state<SVGSVGElement | null>(null);
  let turning = false;

  function angleOf(e: PointerEvent): number {
    const rect = box!.getBoundingClientRect();
    const deg = (Math.atan2(e.clientY - rect.top - rect.height / 2, e.clientX - rect.left - rect.width / 2) * 180) / Math.PI + 90;
    const wrapped = ((deg + 180) % 360 + 360) % 360 - 180;
    return e.shiftKey ? Math.round(wrapped / SNAP_DEG) * SNAP_DEG : Math.round(wrapped);
  }

  function start(e: PointerEvent) {
    turning = true;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    onchange(angleOf(e));
  }

  function move(e: PointerEvent) {
    if (turning) {
      onchange(angleOf(e));
    }
  }
</script>

<svg
  bind:this={box}
  class="dial"
  width={SIZE}
  height={SIZE}
  viewBox={`0 0 ${SIZE} ${SIZE}`}
  role="slider"
  tabindex="0"
  aria-label={label}
  aria-valuenow={value}
  onpointerdown={start}
  onpointermove={move}
  onpointerup={() => (turning = false)}
>
  <rect x="0.5" y="0.5" width={SIZE - 1} height={SIZE - 1} class="frame" />
  <line x1={SIZE / 2} y1={SIZE / 2} x2={SIZE / 2} y2="4" class="needle" transform={`rotate(${value} ${SIZE / 2} ${SIZE / 2})`} />
</svg>

<style>
  .dial {
    cursor: grab;
    touch-action: none;
    flex-shrink: 0;
  }

  .frame {
    fill: var(--paper-2);
    stroke: var(--line);
  }

  .needle {
    stroke: #a855f7;
    stroke-width: 2;
  }
</style>
