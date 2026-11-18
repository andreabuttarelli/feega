<script lang="ts">
  import { FrameMode } from '$lib/canvas/live-budget';
  import { liveUrl, type LiveFrame } from '$lib/canvas/live-frame';
  import { LiveAsk as Ask, pickOf, type LivePreview, type LiveRect } from '$lib/canvas/live-fields';
  import { dropLive, liveSelection, selectLive } from '$lib/canvas/live-selection.svelte';

  let { id, live, mode, origin, poster, selected, onsnapshot }: { id: string; live: LiveFrame; mode: FrameMode; origin: string | null; poster: string | null; selected: boolean; onsnapshot: () => void } = $props();

  const INSPECT = 'feega:inspect';
  const INSPECT_RESULT = 'feega:inspect:result';
  const PREVIEW = 'feega:preview';
  const REFRESH_MS = 900;

  let box = $state(0);
  let mounted = $state(false);
  let frame = $state<HTMLIFrameElement | undefined>();
  let hover = $state<LiveRect | null>(null);
  let seq = 0;
  let moving = false;
  const asks = new Map<number, Ask>();
  const scale = $derived(box ? box / live.width : 1);
  const showsLive = $derived(origin !== null && mode === FrameMode.Live);
  const editing = $derived(selected && showsLive);
  const picked = $derived(liveSelection.current?.nodeId === id ? liveSelection.current : null);

  $effect(() => {
    if (showsLive) {
      mounted = true;
    }
  });

  $effect(() => {
    if (showsLive && mounted) {
      onsnapshot();
    }
  });

  $effect(() => {
    if (!editing) {
      hover = null;
      dropLive(id);
    }
  });

  function ask(kind: Ask, request: { x: number; y: number } | { selector: string }) {
    const next = ++seq;
    asks.set(next, kind);
    frame?.contentWindow?.postMessage({ type: INSPECT, id: next, ...request }, '*');
  }

  function pointAt(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const k = live.width / rect.width;
    return { x: (e.clientX - rect.left) * k, y: (e.clientY - rect.top) * k };
  }

  function onmove(e: PointerEvent) {
    if (moving) {
      return;
    }
    moving = true;
    const at = pointAt(e);
    requestAnimationFrame(() => {
      moving = false;
      ask(Ask.Hover, at);
    });
  }

  function refresh() {
    const source = picked?.pick?.source;
    if (source) {
      ask(Ask.Refresh, { selector: `[data-feega-src="${source}"]` });
    }
  }

  function preview(next: LivePreview) {
    const source = liveSelection.current?.pick?.source;
    if (!source) {
      return;
    }
    frame?.contentWindow?.postMessage({ type: PREVIEW, source, ...next }, '*');
    setTimeout(refresh, REFRESH_MS);
  }

  function onmessage(e: MessageEvent) {
    if (!frame || e.source !== frame.contentWindow || e.data?.type !== INSPECT_RESULT) {
      return;
    }
    const kind = asks.get(e.data.id);
    asks.delete(e.data.id);
    const pick = pickOf(e.data.result);
    if (kind === Ask.Hover) {
      hover = pick?.rect ?? null;
      return;
    }
    if (kind === Ask.Pick || (kind === Ask.Refresh && pick)) {
      selectLive({ nodeId: id, pick, untagged: pick === null, preview });
    }
  }

  const boxStyle = (r: LiveRect) => `left:${r.x * scale}px;top:${r.y * scale}px;width:${r.width * scale}px;height:${r.height * scale}px`;
</script>

<svelte:window {onmessage} />

<div class="live" bind:clientWidth={box} data-testid="live-frame" data-mode={showsLive ? FrameMode.Live : FrameMode.Snapshot} data-route={live.route}>
  {#if mounted && origin}
    <iframe
      bind:this={frame}
      class="page"
      class:hidden={!showsLive}
      title={live.route}
      src={liveUrl(origin, live.route)}
      style={`width:${live.width}px;height:${100 / scale}%;transform:scale(${scale})`}
      onload={() => {
        onsnapshot();
        refresh();
      }}
    ></iframe>
  {/if}
  {#if editing}
    <div class="edit nodrag" role="presentation" data-testid="live-frame-edit" onpointermove={onmove} onpointerleave={() => (hover = null)} onclick={(e) => ask(Ask.Pick, pointAt(e))}>
      {#if hover}
        <div class="outline hover" style={boxStyle(hover)}></div>
      {/if}
      {#if picked?.pick}
        <div class="outline picked" style={boxStyle(picked.pick.rect)} data-testid="live-frame-picked" data-source={picked.pick.source}></div>
      {/if}
      {#if picked?.untagged}
        <span class="badge rounded-full" data-testid="live-frame-untagged">Not tagged · run feega init</span>
      {/if}
    </div>
  {/if}
  {#if poster && !showsLive}
    <img class="poster" src={poster} alt={live.route} draggable="false" data-testid="live-frame-poster" />
  {/if}
  {#if !origin}
    <span class="badge rounded-full" data-testid="live-frame-offline">Not connected · {live.route}</span>
  {/if}
</div>

<style>
  .live { position: relative; width: 100%; height: 100%; overflow: hidden; background: #fff; }
  .page { position: absolute; top: 0; left: 0; border: 0; transform-origin: 0 0; }
  .hidden { visibility: hidden; }
  .poster { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: top; }
  .badge { position: absolute; left: 8px; bottom: 8px; font-size: 11px; padding: 3px 8px; background: rgba(0, 0, 0, 0.7); color: #fff; }
  .edit { position: absolute; inset: 0; cursor: default; }
  .outline { position: absolute; pointer-events: none; box-sizing: border-box; }
  .outline.hover { border: 1px solid var(--ui-accent, #0a84ff); }
  .outline.picked { border: 2px solid var(--ui-accent, #0a84ff); }
</style>
