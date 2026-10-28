<script lang="ts">
  import type { Snippet } from 'svelte';
  import ChevronUp from '@lucide/svelte/icons/chevron-up';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import { placeMenu, type MenuPlacement } from '$lib/canvas/menu-placement';
  import { MENU_CONTENT } from '$lib/components/ui/shell';

  const SCROLL_PX_PER_FRAME = 6;
  const EDGE_EPSILON_PX = 1;
  const ITEM = '[role="menuitem"]';

  const Dir = { Up: -1, Down: 1 } as const;

  let { at, children }: { at: { x: number; y: number }; children: Snippet } = $props();

  let root: HTMLDivElement | undefined = $state();
  let scroller: HTMLDivElement | undefined = $state();
  let placement: MenuPlacement = $state({ x: at.x, y: at.y, maxHeight: Number.MAX_SAFE_INTEGER, scrollable: false });
  let canUp = $state(false);
  let canDown = $state(false);
  let raf = 0;

  function measure() {
    if (!root || !scroller) {
      return;
    }
    const size = { width: root.offsetWidth, height: scroller.scrollHeight + (root.offsetHeight - scroller.offsetHeight) };
    placement = placeMenu({ anchor: at, size, viewport: { width: window.innerWidth, height: window.innerHeight } });
    syncEdges();
  }

  function syncEdges() {
    if (!scroller) {
      return;
    }
    canUp = scroller.scrollTop > EDGE_EPSILON_PX;
    canDown = scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - EDGE_EPSILON_PX;
  }

  function glide(dir: (typeof Dir)[keyof typeof Dir]) {
    cancelAnimationFrame(raf);
    const step = () => {
      if (!scroller) {
        return;
      }
      scroller.scrollTop += dir * SCROLL_PX_PER_FRAME;
      syncEdges();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  function stop() {
    cancelAnimationFrame(raf);
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') {
      return;
    }
    const items = [...(root?.querySelectorAll<HTMLElement>(ITEM) ?? [])];
    const current = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? (current + 1) % items.length : (current <= 0 ? items.length : current) - 1;
    e.preventDefault();
    items[next]?.focus();
    items[next]?.scrollIntoView({ block: 'nearest' });
    syncEdges();
  }

  $effect(() => {
    void at;
    measure();
    return stop;
  });
</script>

<svelte:window onresize={measure} />

<div
  bind:this={root}
  class={MENU_CONTENT}
  role="menu"
  tabindex="-1"
  data-testid="canvas-menu"
  data-scrollable={placement.scrollable}
  {onkeydown}
  onclick={(e) => e.stopPropagation()}
  onpointerdown={(e) => e.stopPropagation()}
  style={`position: fixed; z-index: 70; min-width: 200px; left: ${placement.x}px; top: ${placement.y}px; max-height: ${placement.maxHeight}px; display: flex; flex-direction: column`}
>
  {#if canUp}
    <div class="grid h-5 shrink-0 place-items-center text-ui-icon" role="presentation" data-edge="up" onpointerenter={() => glide(Dir.Up)} onpointerleave={stop}>
      <ChevronUp size={14} aria-hidden="true" />
    </div>
  {/if}
  <div bind:this={scroller} class="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none]" onscroll={syncEdges}>
    {@render children()}
  </div>
  {#if canDown}
    <div class="grid h-5 shrink-0 place-items-center text-ui-icon" role="presentation" data-edge="down" onpointerenter={() => glide(Dir.Down)} onpointerleave={stop}>
      <ChevronDown size={14} aria-hidden="true" />
    </div>
  {/if}
</div>
