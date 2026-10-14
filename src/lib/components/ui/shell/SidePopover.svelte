<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils.js';
  import { FOCUS_RING } from './styles';
  import { SideMode, sidePlacement, type SidePlace } from './side-popover';

  let {
    anchor,
    within = null,
    title,
    label = title,
    swatch = '',
    key = '',
    onclose,
    children
  }: {
    anchor: HTMLElement;
    within?: HTMLElement | null;
    title: string;
    label?: string;
    swatch?: string;
    key?: string;
    onclose: () => void;
    children: Snippet;
  } = $props();

  const EDGE_SELECTOR = '[data-side-edge]';

  let box = $state<HTMLDivElement | null>(null);
  let height = $state(0);
  let place = $state<SidePlace | null>(null);

  function measure() {
    const row = anchor.getBoundingClientRect();
    const edge = (anchor.closest(EDGE_SELECTOR) ?? within ?? anchor).getBoundingClientRect().left;
    place = sidePlacement({ row, edge, height, viewport: { width: window.innerWidth, height: window.innerHeight } });
  }

  $effect(() => {
    void anchor;
    void height;
    measure();
  });

  const inside = (target: EventTarget | null, el: HTMLElement | null) => !!el && target instanceof Node && el.contains(target);

  function outside(e: Event) {
    if (inside(e.target, box) || inside(e.target, within)) {
      return;
    }
    onclose();
  }

  function keydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') {
      return;
    }
    e.stopPropagation();
    onclose();
  }

  const style = $derived(place?.mode === SideMode.Side ? `left:${place.left}px;top:${place.top}px;width:${place.width}px` : '');
</script>

<svelte:window onkeydowncapture={keydown} onpointerdown={outside} onresize={measure} />

<div
  bind:this={box}
  bind:clientHeight={height}
  role="dialog"
  aria-label={label}
  data-testid="side-popover"
  data-anchor={key}
  data-mode={place?.mode ?? SideMode.Side}
  class={cn('fixed z-[60] flex flex-col overflow-auto border border-ui-divider bg-ui-panel shadow-ui-float', place?.mode === SideMode.Sheet ? 'inset-x-0 bottom-0 max-h-[70vh] rounded-t-lg' : 'max-h-[calc(100vh-16px)] rounded-md')}
  {style}
>
  <div class="flex h-(--ui-row) shrink-0 items-center gap-2 border-b border-ui-divider px-2">
    {#if swatch}<span class="size-[14px] shrink-0 rounded-xs border border-ui-divider" data-testid="side-popover-swatch" style={`background:${swatch}`}></span>{/if}
    <span class="min-w-0 flex-1 truncate text-ui-label font-semibold text-ui-text" data-testid="side-popover-title">{title}</span>
    <button type="button" class={cn('inline-flex size-6 items-center justify-center rounded-sm text-ui-icon hover:bg-ui-wash hover:text-ui-text', FOCUS_RING)} data-testid="side-popover-close" aria-label="Close" onclick={onclose}>×</button>
  </div>
  <div class="p-2">{@render children()}</div>
</div>
