<script lang="ts">
  import { onMount } from 'svelte';
  import { liveUrl } from '$lib/canvas/live-frame';
  import { devServerAction } from '$lib/canvas/dev-server-client';
  import { PageHost, PageState, pageHostOf, pageStateOf, playWidth, type LivePage } from '$lib/canvas/play-target';
  import { DEVICES, DEVICE_ORDER, Device, deviceForKey } from '$lib/motion/prototype/device';
  import { portalInto } from '$lib/components/brand-agent/right-bar-host.svelte';
  import { IconButton, IconSize, Kbd, Side } from '$lib/components/ui/shell';
  import Monitor from '@lucide/svelte/icons/monitor';
  import TabletIcon from '@lucide/svelte/icons/tablet';
  import Smartphone from '@lucide/svelte/icons/smartphone';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import Bug from '@lucide/svelte/icons/bug';
  import X from '@lucide/svelte/icons/x';
  import Maximize from '@lucide/svelte/icons/maximize-2';
  import Minimize from '@lucide/svelte/icons/minimize-2';

  type Guest = HTMLElement & { openDevTools?: () => void };

  let { page, origin, onclose }: { page: LivePage; origin: string | null; onclose: () => void } = $props();

  const STAGE_PAD_PX = 16;
  const DEVICE_ICON = { [Device.Desktop]: Monitor, [Device.Tablet]: TabletIcon, [Device.Phone]: Smartphone };
  const host = pageHostOf(typeof navigator === 'undefined' ? null : navigator.userAgent);

  let width = $state(playWidth(page.width));
  let run = $state(0);
  let stageW = $state(0);
  let stageH = $state(0);
  let full = $state(false);
  let starting = $state(false);
  let started = $state<string | null>(null);
  let guest = $state<Guest>();
  let root = $state<HTMLElement>();

  const served = $derived(origin ?? started);
  const serving = $derived(pageStateOf(served));
  const scale = $derived(stageW ? Math.min(1, (stageW - STAGE_PAD_PX * 2) / width) : 1);
  const height = $derived(Math.max(0, (stageH - STAGE_PAD_PX * 2) / scale));
  const src = $derived(served ? liveUrl(served, page.route) : '');

  const setWidth = (next: number) => (width = playWidth(next));
  const restart = () => run++;
  const devtools = () => guest?.openDevTools?.();

  async function startServer() {
    starting = true;
    started = await devServerAction('start').then((s) => s.url, () => null);
    starting = false;
  }

  function toggleFull() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void document.documentElement.requestFullscreen?.();
  }

  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }
    const device = deviceForKey(e.key);
    if (device) {
      setWidth(DEVICES[device].width);
      return;
    }
    const keys: Record<string, () => void> = { f: toggleFull, F: toggleFull, r: restart, R: restart, Escape: onclose };
    keys[e.key]?.();
  }

  onMount(() => root?.focus());
</script>

<svelte:document onfullscreenchange={() => (full = Boolean(document.fullscreenElement))} />

<div class="player" class:full role="dialog" tabindex="-1" bind:this={root} onkeydown={onKey} aria-label="Live page player" data-testid="live-page-player" data-host={host} data-state={serving} use:portalInto={document.body}>
  <header class="bar">
    <div class="zone">
      <span class="title name">{page.name}</span>
      <span class="sub">{page.route}</span>
    </div>

    <div class="zone" role="toolbar" aria-label="Viewport">
      <div class="group">
        {#each DEVICE_ORDER as device (device)}
          {@const Icon = DEVICE_ICON[device]}
          <IconButton label={DEVICES[device].label} shortcut={DEVICES[device].key} size={IconSize.Sm} side={Side.Bottom} pressed={width === DEVICES[device].width} data-testid={`device-${device}`} onclick={() => setWidth(DEVICES[device].width)}><Icon /></IconButton>
        {/each}
        <span class="sep"></span>
        <label class="width">
          <input type="number" min="120" max="4096" aria-label="Width in pixels" data-testid="viewport-width" value={width} onchange={(e) => setWidth(e.currentTarget.valueAsNumber)} />
          <span>px</span>
        </label>
      </div>
    </div>

    <div class="zone end">
      <span class="pill" data-testid="viewport-zoom">{Math.round(scale * 100)}%</span>
      <IconButton label="Restart" shortcut="R" size={IconSize.Sm} side={Side.Bottom} data-testid="prototype-restart" onclick={restart}><RotateCcw /></IconButton>
      {#if host === PageHost.Webview}
        <IconButton label="Open devtools" size={IconSize.Sm} side={Side.Bottom} data-testid="live-devtools" disabled={serving === PageState.Down} onclick={devtools}><Bug /></IconButton>
      {/if}
      <IconButton label={full ? 'Exit full screen' : 'Full screen'} shortcut="F" size={IconSize.Sm} side={Side.Bottom} data-testid="prototype-fullscreen" onclick={toggleFull}>
        {#if full}<Minimize />{:else}<Maximize />{/if}
      </IconButton>
      <span class="sep"></span>
      <IconButton label="Close" shortcut="Escape" size={IconSize.Sm} side={Side.Bottom} data-testid="prototype-close" onclick={onclose}><X /></IconButton>
    </div>
  </header>

  <div class="stage" bind:clientWidth={stageW} bind:clientHeight={stageH}>
    <div class="sizer" style={`width:${width * scale}px;height:${height * scale}px`}>
      {#if serving === PageState.Running}
        {#key run}
          {#if host === PageHost.Webview}
            <webview bind:this={guest} class="page" {src} title={page.route} data-testid="live-page" style={`width:${width}px;height:${height}px;transform:scale(${scale})`}></webview>
          {:else}
            <iframe class="page" {src} title={page.route} data-testid="live-page" style={`width:${width}px;height:${height}px;transform:scale(${scale})`}></iframe>
          {/if}
        {/key}
      {:else}
        {#if page.poster}
          <img class="poster" src={page.poster} alt={page.route} draggable="false" data-testid="live-page-poster" />
        {/if}
        <div class="down" data-testid="live-page-down">
          <span>Dev server not running</span>
          <button type="button" class="start rounded-sm" data-testid="live-page-start" disabled={starting} onclick={startServer}>{starting ? 'Starting…' : 'Start dev server'}</button>
        </div>
      {/if}
    </div>
  </div>
  <span class="esc" aria-hidden="true"><Kbd shortcut="Escape" /> to close</span>
</div>

<style>
  .player { position: fixed; inset: 0; z-index: 1000; display: flex; flex-direction: column; background: var(--ui-canvas); color: var(--ui-text); font-size: var(--ui-text-md); outline: none; }
  :global(body:has([data-testid='live-page-player']) [data-slot='hint'][data-slot='hint']) { z-index: 1001; }
  .bar { flex: none; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; height: 48px; padding: 0 8px 0 16px; background: var(--ui-panel); border-bottom: 1px solid var(--ui-divider); }
  .zone { display: flex; align-items: center; gap: 4px; min-width: 0; }
  .end { justify-content: flex-end; }
  .title { font-weight: 600; }
  .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sub { margin-left: 6px; color: var(--ui-text-secondary); font-size: var(--ui-text-sm); white-space: nowrap; }
  .group { display: flex; align-items: center; gap: 2px; padding: 2px; border-radius: var(--ui-radius-md); background: var(--ui-input); }
  .sep { width: 1px; height: 16px; margin: 0 4px; background: var(--ui-divider-strong); }
  .pill { display: inline-flex; align-items: center; height: 28px; padding: 0 8px; color: var(--ui-text-secondary); font-size: var(--ui-text-sm); font-variant-numeric: tabular-nums; }
  .width { display: flex; align-items: center; height: 28px; padding-right: 6px; border-radius: var(--ui-radius-sm); color: var(--ui-text-secondary); font-size: var(--ui-text-sm); }
  .width:focus-within { background: var(--ui-panel); box-shadow: inset 0 0 0 1px var(--ui-mode-solid); }
  .width input { width: 40px; height: 28px; padding: 0 3px 0 6px; border: 0; background: transparent; color: var(--ui-text); font: inherit; font-variant-numeric: tabular-nums; text-align: right; outline: none; appearance: textfield; }
  .width input::-webkit-inner-spin-button, .width input::-webkit-outer-spin-button { appearance: none; margin: 0; }
  .stage { flex: 1; min-height: 0; display: flex; justify-content: center; align-items: center; padding: 16px; overflow: hidden; }
  .full .stage { padding-top: 16px; }
  .sizer { position: relative; flex: none; overflow: hidden; border-radius: var(--ui-radius-md); box-shadow: var(--ui-shadow-float); background: #fff; }
  .page { position: absolute; top: 0; left: 0; border: 0; transform-origin: 0 0; display: flex; }
  .poster { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: top; opacity: 0.5; }
  .down { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--ui-text); font-size: var(--ui-text-sm); }
  .start { height: 32px; padding: 0 12px; border: 0; background: var(--ui-mode-solid); color: var(--ui-mode-ink, #fff); font: inherit; cursor: pointer; }
  .start:disabled { opacity: 0.6; cursor: default; }
  .esc { position: absolute; right: 16px; bottom: 12px; display: flex; align-items: center; gap: 6px; color: var(--ui-text-3); font-size: var(--ui-text-xs); pointer-events: none; }
</style>
