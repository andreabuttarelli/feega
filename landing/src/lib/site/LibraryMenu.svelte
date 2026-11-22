<script lang="ts">
  import { page } from '$app/state';
  import Pixel from './alternatives/Pixel.svelte';
  import { inLibrary, LIBRARY_ITEMS, LIBRARY_LABEL } from './library-menu';

  const HOVER_OPEN_MS = 120;
  const HOVER_CLOSE_MS = 220;

  let { freeTemplates }: { freeTemplates: number } = $props();

  let open = $state(false);
  let root: HTMLDivElement;
  let trigger: HTMLButtonElement;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const active = $derived(inLibrary(page.url.pathname));

  function later(next: boolean, ms: number) {
    clearTimeout(timer);
    timer = setTimeout(() => (open = next), ms);
  }

  function onEnter(event: PointerEvent) {
    if (event.pointerType === 'mouse') {
      later(true, HOVER_OPEN_MS);
    }
  }

  function onLeave(event: PointerEvent) {
    if (event.pointerType === 'mouse') {
      later(false, HOVER_CLOSE_MS);
    }
  }

  function toggle() {
    clearTimeout(timer);
    open = !open;
  }

  function onKey(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !open) {
      return;
    }

    open = false;
    trigger.focus();
  }

  function onPointer(event: PointerEvent) {
    if (open && !root.contains(event.target as Node)) {
      open = false;
    }
  }

  function onFocusOut(event: FocusEvent) {
    if (open && !root.contains(event.relatedTarget as Node | null)) {
      open = false;
    }
  }

  function onTriggerKey(event: KeyboardEvent) {
    if (event.key !== 'ArrowDown') {
      return;
    }

    event.preventDefault();
    open = true;
    queueMicrotask(() => root.querySelector<HTMLAnchorElement>('[role="menuitem"]')?.focus());
  }
</script>

<svelte:window onkeydown={onKey} onpointerdown={onPointer} />

<div class="lib" bind:this={root} onpointerenter={onEnter} onpointerleave={onLeave} onfocusout={onFocusOut} role="presentation">
  <button
    class="sx-pill"
    type="button"
    bind:this={trigger}
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls="library-menu"
    aria-current={active ? 'page' : undefined}
    onclick={toggle}
    onkeydown={onTriggerKey}
  >
    {LIBRARY_LABEL}
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
  </button>

  {#if open}
    <div class="menu" id="library-menu" role="menu">
      {#each LIBRARY_ITEMS as item (item.href)}
        <a role="menuitem" href={item.href} aria-current={inLibrary(page.url.pathname, [item.href]) ? 'page' : undefined} onclick={() => (open = false)}>
          <span class="icon"><Pixel icon={item.icon} size={4} /></span>
          <span class="text">
            <span class="label">{item.label}</span>
            <span class="desc">{item.describe(freeTemplates)}</span>
          </span>
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .lib {
    position: relative;
  }

  .sx-pill {
    gap: 6px;
  }

  .menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    display: flex;
    flex-direction: column;
    width: 320px;
    padding: 6px;
    border: 1px solid rgb(255 255 255 / 0.15);
    border-radius: var(--sx-radius-lg);
    background: #111;
    box-shadow: 0 24px 60px rgb(0 0 0 / 0.6);
  }

  .menu a {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 10px;
    border-radius: var(--sx-radius-sm);
  }

  .menu a:hover,
  .menu a:focus-visible {
    background: rgb(255 255 255 / 0.1);
    outline: none;
  }

  .menu a[aria-current='page'] {
    background: var(--sx-pill);
  }

  .icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 32px;
    height: 32px;
    border-radius: var(--sx-radius-md);
    background: rgb(255 255 255 / 0.06);
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .label {
    font-size: 16px;
  }

  .desc {
    color: rgb(255 255 255 / 0.55);
    font-size: 13px;
    line-height: 1.35;
  }
</style>
