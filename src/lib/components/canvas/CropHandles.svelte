<script lang="ts">
  import { Corner, appliedCrop, cornerZoom, imagePlacement, panned, windowOfFit, zoomedAt, type Pt, type Window } from '$lib/canvas/crop-handles';
  import type { FillOf, FillType } from '$lib/motion/fill/model';

  type Rect = { left: number; top: number; width: number; height: number };
  type ImageFill = FillOf<FillType.Image>;

  let { rect, fill, src, onchange, onapply, oncancel }: { rect: Rect; fill: ImageFill; src: string; onchange: (fill: ImageFill) => void; onapply: () => void; oncancel: () => void } = $props();

  const CORNERS = Object.values(Corner);
  const WHEEL_STEP = 0.0015;
  const DIM = 0.4;
  const HANDLE = 10;
  const BIG = 100000;

  const size = $derived({ width: rect.width, height: rect.height });
  let natural = $state<{ width: number; height: number } | null>(null);
  let win = $state<Window | null>(null);
  let held: { kind: 'pan' | Corner; at: Pt } | null = null;

  $effect(() => {
    const probe = new Image();
    probe.onload = () => {
      natural = { width: probe.naturalWidth, height: probe.naturalHeight };
    };
    probe.src = src;
  });

  $effect(() => {
    if (natural && !win) {
      win = windowOfFit(fill, size, natural);
      onchange(appliedCrop(fill, win));
    }
  });

  const placed = $derived(win ? imagePlacement(win, size) : null);
  const hole = $derived(placed ? `path(evenodd, 'M${-BIG} ${-BIG}h${2 * BIG}v${2 * BIG}h${-2 * BIG}zM${-placed.x} ${-placed.y}h${size.width}v${size.height}h${-size.width}z')` : '');

  function set(next: Window) {
    win = next;
    onchange(appliedCrop(fill, next));
  }

  function local(e: PointerEvent): Pt {
    const box = (e.currentTarget as Element).closest('[data-testid="crop-handles"]')!.getBoundingClientRect();
    return [e.clientX - box.left, e.clientY - box.top];
  }

  function start(e: PointerEvent, kind: 'pan' | Corner) {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    held = { kind, at: local(e) };
  }

  function move(e: PointerEvent) {
    if (!held || !win) {
      return;
    }
    const at = local(e);
    set(held.kind === 'pan' ? panned(win, size, at[0] - held.at[0], at[1] - held.at[1]) : cornerZoom(win, size, held.kind, at));
    held = { ...held, at };
  }

  function end() {
    held = null;
  }

  function wheel(e: WheelEvent) {
    if (!win) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const box = (e.currentTarget as Element).getBoundingClientRect();
    set(zoomedAt(win, size, [e.clientX - box.left, e.clientY - box.top], Math.exp(-e.deltaY * WHEEL_STEP)));
  }

  const handleAt = (corner: Corner, r: NonNullable<typeof placed>) => {
    const x = corner.endsWith('left') ? r.x : r.x + r.width;
    const y = corner.startsWith('top') ? r.y : r.y + r.height;
    return `left:${x - HANDLE / 2}px;top:${y - HANDLE / 2}px;width:${HANDLE}px;height:${HANDLE}px`;
  };
</script>

<div class="crop" data-testid="crop-handles" style="left:{rect.left}px;top:{rect.top}px;width:{rect.width}px;height:{rect.height}px" onpointermove={move} onpointerup={end} onpointercancel={end} role="presentation">
  {#if placed && win}
    <img class="ghost" alt="" draggable="false" {src} style="left:{placed.x}px;top:{placed.y}px;width:{placed.width}px;height:{placed.height}px;opacity:{DIM};clip-path:{hole}" />
    <div class="pan" data-testid="crop-pan" onpointerdown={(e) => start(e, 'pan')} onwheel={wheel} role="presentation"></div>
    <div class="frame"></div>
    <div class="outline" style="left:{placed.x}px;top:{placed.y}px;width:{placed.width}px;height:{placed.height}px"></div>
    {#each CORNERS as corner (corner)}
      <div class="grip" data-testid="crop-grip-{corner}" style={handleAt(corner, placed)} onpointerdown={(e) => start(e, corner)} role="presentation"></div>
    {/each}
    <div class="actions">
      <button type="button" data-testid="crop-apply" onpointerdown={(e) => e.stopPropagation()} onclick={onapply}>Done</button>
      <button type="button" data-testid="crop-cancel" onpointerdown={(e) => e.stopPropagation()} onclick={oncancel}>Cancel</button>
    </div>
  {/if}
</div>

<style>
  .crop {
    position: absolute;
    overflow: visible;
    pointer-events: none;
  }

  .ghost {
    position: absolute;
    max-width: none;
    pointer-events: none;
  }

  .pan {
    position: absolute;
    inset: 0;
    cursor: move;
    pointer-events: auto;
  }

  .frame {
    position: absolute;
    inset: 0;
    outline: 1.5px solid #fff;
    box-shadow: 0 0 0 1px rgb(0 0 0 / 0.5);
    pointer-events: none;
  }

  .outline {
    position: absolute;
    outline: 1px dashed rgb(255 255 255 / 0.7);
    pointer-events: none;
  }

  .grip {
    position: absolute;
    background: #fff;
    border: 1.5px solid var(--ui-accent, #3b82f6);
    pointer-events: auto;
    cursor: nwse-resize;
  }

  .grip[data-testid$='top-right'],
  .grip[data-testid$='bottom-left'] {
    cursor: nesw-resize;
  }

  .actions {
    position: absolute;
    right: 0;
    bottom: calc(100% + 8px);
    display: flex;
    gap: 6px;
    pointer-events: auto;
  }

  .actions button {
    padding: 2px 10px;
    font-size: 12px;
    color: #fff;
    background: rgb(20 20 20 / 0.85);
    border: 1px solid rgb(255 255 255 / 0.3);
    border-radius: 4px;
  }
</style>
