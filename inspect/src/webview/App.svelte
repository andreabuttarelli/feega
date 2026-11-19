<script lang="ts">
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import ArrowRight from '@lucide/svelte/icons/arrow-right';
  import RotateCw from '@lucide/svelte/icons/rotate-cw';
  import ExternalLink from '@lucide/svelte/icons/external-link';
  import PanelRight from '@lucide/svelte/icons/panel-right';
  import Undo2 from '@lucide/svelte/icons/undo-2';
  import { LiveProp } from '@feega/live-edit/live-fields';
  import { Mode, Move, ServerState, Styling, ToHost, ToView, type Pick, type Prefs, type Source, type ViewMessage } from '../messages';
  import { fromHost, toHost } from './host';
  import { pageBridge, sourceText } from './page-bridge';
  import Properties from './Properties.svelte';
  import ModeSwitch from './ModeSwitch.svelte';
  import FeegaMenu from './FeegaMenu.svelte';
  import Breadcrumb from './Breadcrumb.svelte';
  import { SettingKey, type ReportFacts, type Settings } from '../settings';
  import { ROWS, type Row } from './controls';
  import { modeOfKey } from './modes';
  import { browseHistory } from './history';
  import { serverLook } from './server-look';
  import { DEFAULT_ANCHOR, anchorBox, isAnchor, nearestAnchor, nextAnchor, type Anchor } from './anchors';
  import { PRESETS, SIZES, Size, fitOf, sizeForKey, snapped } from './sizes';

  const SETTLE_MS = 1200;
  const BAR_PX = 260;

  let url = $state('');
  let start = $state('');
  let route = $state('/');
  let address = $state('/');
  let styling = $state(Styling.Tailwind);
  let server = $state(ServerState.Detecting);
  let serverReason = $state('');
  let bridged = $state(false);
  let mode = $state(Mode.Design);
  let editing = $state(false);
  let hover = $state<Pick | null>(null);
  let picked = $state<Pick | null>(null);
  let frame = $state<HTMLIFrameElement | null>(null);
  let saved = $state<Source | null>(null);
  let problem = $state<{ text: string; at?: Source } | null>(null);
  let warning = $state('');
  let size = $state(Size.Full);
  let custom = $state<number | null>(null);
  let barClosed = $state(false);
  let stage = $state({ w: 0, h: 0 });
  let dragging = $state<{ x: number; width: number; side: number } | null>(null);
  let navTick = $state(0);
  let anchor = $state<Anchor>(DEFAULT_ANCHOR);
  let bar = $state({ w: 0, h: 0 });
  let toolbarH = $state(0);
  let moving = $state<{ dx: number; dy: number; x: number; y: number } | null>(null);
  let settings = $state<Settings | null>(null);
  let facts = $state<ReportFacts | null>(null);

  const history = browseHistory();
  let savedPrefs = false;
  const fit = $derived(fitOf(size, custom, stage));
  const area = $derived({ x: 0, y: toolbarH, w: stage.w, h: stage.h });
  const barAt = $derived(moving ? { x: moving.x, y: moving.y } : anchorBox(anchor, area, bar));
  const look = $derived(serverLook(server));
  const canBack = $derived((navTick, history.canBack()));
  const canForward = $derived((navTick, history.canForward()));

  const bridge = pageBridge(() => frame, {
    ready: (path) => {
      bridged = true;
      server = ServerState.Running;
      visited(path);
      bridge.mode(mode);
      refresh();
    },
    moved: visited,
    scrolled: () => {
      hover = null;
      refresh();
    },
    settled: (_source, unapplied) => {
      warning = unapplied.length ? `Saved, but ${unapplied.join(', ')} has no effect on this page` : '';
      refresh();
    },
    text: (source, text) => {
      editing = false;
      toHost({ kind: ToHost.Edit, ask: { at: source, prop: LiveProp.Text, value: text } });
    }
  });

  function visited(path: string) {
    route = path;
    address = path;
    history.visited(path);
    navTick++;
    savePrefs();
  }

  function go(path: string | null) {
    if (path === null || !url) {
      return;
    }
    bridged = false;
    server = ServerState.Reloading;
    frame!.src = new URL(path, url).toString();
  }

  function refresh() {
    if (picked) {
      bridge.again(picked.source).then((p) => (picked = p ?? picked));
    }
  }

  function savePrefs() {
    toHost({ kind: ToHost.Prefs, prefs: { size, custom, barClosed, route, anchor } });
  }

  function restore(prefs: Prefs | null) {
    if (!prefs) {
      return;
    }
    savedPrefs = true;
    size = PRESETS.includes(prefs.size as Size) || prefs.size === Size.Custom ? (prefs.size as Size) : Size.Full;
    custom = prefs.custom;
    barClosed = prefs.barClosed;
    route = prefs.route ?? route;
    anchor = isAnchor(prefs.anchor) ? prefs.anchor : anchor;
  }

  const handlers: { [K in ToView]: (m: Extract<ViewMessage, { kind: K }>) => void } = {
    [ToView.App]: (m) => (restore(m.prefs), (start = new URL(route, m.url).toString()), (url = m.url), (styling = m.styling)),
    [ToView.Settings]: (m) => {
      settings = m.values;
      facts = m.facts;
      const preset = m.values[SettingKey.DefaultSize] as Size;
      if (!savedPrefs && PRESETS.includes(preset)) {
        size = preset;
      }
    },
    [ToView.Server]: (m) => ((server = m.state), (serverReason = m.reason ?? '')),
    [ToView.Status]: (m) => (problem = { text: m.text }),
    [ToView.Edited]: (m) => {
      if (!m.ok) {
        problem = { text: m.reason ?? 'Not saved', at: m.at };
        saved = null;
        if (picked) {
          bridge.clear(picked.source);
          refresh();
        }
        return;
      }
      problem = null;
      saved = m.saved ?? null;
      warning = m.note ?? '';
      server = ServerState.Reloading;
      setTimeout(() => {
        server = bridged ? ServerState.Running : server;
        if (picked) {
          bridge.settle(picked.source);
        }
      }, SETTLE_MS);
    },
    [ToView.Pick]: (m) => bridge.at(m.x, m.y).then((pick) => ((picked = pick), toHost({ kind: ToHost.Picked, id: m.id, pick }))),
    [ToView.Change]: (m) => {
      const row = ROWS.find((r) => r.name === m.row);
      if (row) {
        change(row, m.value);
      }
    }
  };

  fromHost((m) => (handlers[m.kind] as (m: ViewMessage) => void)(m));
  toHost({ kind: ToHost.Ready });

  function setMode(next: Mode) {
    mode = next;
    hover = null;
    bridge.mode(next);
  }

  const pagePoint = (e: MouseEvent) => ({ x: e.offsetX / fit.scale, y: e.offsetY / fit.scale });

  let hovering = false;
  function onMove(e: PointerEvent) {
    if (hovering) {
      return;
    }
    hovering = true;
    const { x, y } = pagePoint(e);
    bridge.at(x, y).then((p) => ((hover = p), (hovering = false)));
  }

  function grabBar(e: PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    moving = { dx: e.clientX - barAt.x, dy: e.clientY - barAt.y, x: barAt.x, y: barAt.y };
  }

  function dragBar(e: PointerEvent) {
    if (moving) {
      moving = { ...moving, x: e.clientX - moving.dx, y: e.clientY - moving.dy };
    }
  }

  function dropBar() {
    if (!moving) {
      return;
    }
    anchor = nearestAnchor({ x: moving.x, y: moving.y }, area, bar);
    moving = null;
    savePrefs();
  }

  function onHandleKey(e: KeyboardEvent) {
    const next = nextAnchor(anchor, e.key);
    if (next !== anchor) {
      e.preventDefault();
      e.stopPropagation();
      anchor = next;
      savePrefs();
    }
  }

  async function onPick(e: MouseEvent) {
    const { x, y } = pagePoint(e);
    picked = await bridge.at(x, y);
  }

  function onDouble(e: MouseEvent) {
    const { x, y } = pagePoint(e);
    editing = true;
    frame?.focus();
    bridge.editText(x, y);
  }

  function preview(row: Row, value: string) {
    if (picked) {
      bridge.preview(picked.source, row.preview(value));
    }
  }

  const kebab = (style: Record<string, string>) => Object.fromEntries(Object.entries(style).map(([k, v]) => [k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), v]));

  function change(row: Row, value: string) {
    if (!picked) {
      return;
    }
    preview(row, value);
    const { prop, side, family, value: written } = row.change(value);
    toHost({ kind: ToHost.Edit, ask: { at: sourceText(picked.source), prop, side, family, value: written, rem: picked.rem, viewport: picked.viewport, css: kebab(row.preview(value)) } });
  }

  function pickSize(next: Size) {
    size = next;
    savePrefs();
  }

  function startDrag(e: PointerEvent, side: number) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging = { x: e.clientX, width: fit.width, side };
  }

  function drag(e: PointerEvent) {
    if (!dragging) {
      return;
    }
    custom = snapped(dragging.width + ((e.clientX - dragging.x) * 2 * dragging.side) / fit.scale);
    size = Size.Custom;
  }

  function endDrag() {
    if (dragging) {
      dragging = null;
      savePrefs();
    }
  }

  function toggleBar() {
    barClosed = !barClosed;
    savePrefs();
  }

  const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;

  const SELECTION_KEYS: Record<string, (e: KeyboardEvent) => Move> = {
    Escape: () => Move.Parent,
    Enter: (e) => (e.shiftKey ? Move.Parent : Move.Child),
    Tab: (e) => (e.shiftKey ? Move.Previous : Move.Next)
  };

  async function select(source: Source) {
    picked = (await bridge.again(source)) ?? picked;
  }

  async function moveSelection(move: Move) {
    if (picked) {
      picked = (await bridge.move(picked.source, move)) ?? picked;
    }
  }

  function onKey(e: KeyboardEvent) {
    const cmd = e.metaKey || e.ctrlKey;
    const selecting = SELECTION_KEYS[e.key];
    if (selecting && picked && mode === Mode.Design && !editing && !typing(e) && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      moveSelection(selecting(e));
      return;
    }
    const shortcuts: Record<string, () => void> = {
      z: () => toHost({ kind: ToHost.Undo }),
      '\\': toggleBar,
      '[': () => go(history.back()),
      ']': () => go(history.forward()),
      r: () => go(route)
    };
    if (cmd && shortcuts[e.key] && !(e.key === 'z' && (e.shiftKey || typing(e)))) {
      e.preventDefault();
      shortcuts[e.key]();
      return;
    }
    if (cmd || typing(e)) {
      return;
    }
    const next = modeOfKey(e.key);
    if (next) {
      setMode(next);
      return;
    }
    const preset = mode === Mode.Design ? sizeForKey(e.key) : null;
    if (preset) {
      pickSize(preset);
    }
  }

  const box = (p: Pick) => `left:${p.rect.x * fit.scale}px;top:${p.rect.y * fit.scale}px;width:${p.rect.width * fit.scale}px;height:${p.rect.height * fit.scale}px`;
  const fileName = (s: Source) => `${s.file.split('/').pop()}:${s.line}`;
</script>

<svelte:window onkeydown={onKey} />

<main style={`grid-template-columns: 1fr ${barClosed ? 0 : BAR_PX}px; --bar: ${barClosed ? 0 : BAR_PX}px`}>
  <section class="view">
    <header class="toolbar" bind:clientHeight={toolbarH}>
      <FeegaMenu values={settings} {facts} onsetting={(key, value) => toHost({ kind: ToHost.Setting, key, value })} onlink={(link) => toHost({ kind: ToHost.External, url: link })} />
      <button type="button" class="icon" title="Back (⌘[)" disabled={!canBack} onclick={() => go(history.back())}><ArrowLeft size={15} /></button>
      <button type="button" class="icon" title="Forward (⌘])" disabled={!canForward} onclick={() => go(history.forward())}><ArrowRight size={15} /></button>
      <button type="button" class="icon" title="Reload (⌘R)" onclick={() => go(route)}><RotateCw size={14} /></button>
      <form class="address" onsubmit={(e) => (e.preventDefault(), go(address))}>
        <span class="dot {look.dot}" title={serverReason || look.label} data-testid="server-dot" data-state={server}></span>
        <input bind:value={address} aria-label="Route" data-testid="address" spellcheck="false" />
        {#if look.action && server === ServerState.Stopped}<button type="button" class="action" onclick={() => toHost({ kind: ToHost.Restart })}>{look.action}</button>{/if}
      </form>
      <select class="device" value={size} onchange={(e) => pickSize(e.currentTarget.value as Size)} aria-label="Device" data-testid="device">
        {#each PRESETS as preset (preset)}<option value={preset}>{SIZES[preset].label}{SIZES[preset].width ? ` ${SIZES[preset].width}` : ''}{SIZES[preset].key ? ` (${SIZES[preset].key})` : ''}</option>{/each}
        {#if size === Size.Custom}<option value={Size.Custom}>Custom</option>{/if}
      </select>
      <input class="width" type="number" value={fit.width} aria-label="Width" onchange={(e) => ((custom = snapped(Number(e.currentTarget.value))), (size = Size.Custom), savePrefs())} />
      {#if fit.scale < 1}<span class="zoom" data-testid="zoom">{Math.round(fit.scale * 100)}%</span>{/if}
      <button type="button" class="icon" title="Open in browser" onclick={() => toHost({ kind: ToHost.External, url: new URL(route, url).toString() })}><ExternalLink size={14} /></button>
      <button type="button" class="icon" class:on={!barClosed} title="Properties (⌘\)" onclick={toggleBar} data-testid="bar-toggle"><PanelRight size={15} /></button>
    </header>

    <div class="backdrop" role="presentation" bind:clientWidth={stage.w} bind:clientHeight={stage.h} onpointermove={drag} onpointerup={endDrag}>
      <div class="frame" class:framed={size !== Size.Full} style={`width:${fit.width * fit.scale}px;height:${fit.height * fit.scale}px`}>
        {#if url}<iframe bind:this={frame} src={start} title="App" data-testid="app-frame" style={`width:${fit.width}px;height:${fit.height}px;transform:scale(${fit.scale})`}></iframe>{/if}
        {#if mode === Mode.Design && bridged && !editing}
          <div class="overlay" role="presentation" onpointermove={onMove} onpointerleave={() => (hover = null)} onclick={onPick} ondblclick={onDouble} onwheel={(e) => bridge.scroll(e.deltaX / fit.scale, e.deltaY / fit.scale)}>
            {#if hover}<div class="outline hover" style={box(hover)}></div>{/if}
            {#if picked}<div class="outline picked" style={box(picked)}><span class="label"><Breadcrumb pick={picked} onselect={select} compact /></span></div>{/if}
          </div>
        {/if}
        {#if size !== Size.Full}
          <span class="handle left" role="separator" aria-label="Resize" onpointerdown={(e) => startDrag(e, -1)}></span>
          <span class="handle right" role="separator" aria-label="Resize" onpointerdown={(e) => startDrag(e, 1)}></span>
          <span class="width-label" class:live={dragging}>{fit.width}px</span>
        {/if}
      </div>

      <div class="float" class:moving bind:clientWidth={bar.w} bind:clientHeight={bar.h} style={`left:${barAt.x}px;top:${barAt.y}px`} data-anchor={anchor}>
        <button type="button" class="grip" title="Drag to move (arrow keys)" aria-label="Move the bar" onpointerdown={grabBar} onpointermove={dragBar} onpointerup={dropBar} onkeydown={onHandleKey}>
          <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden="true">{#each [0, 1, 2] as row (row)}{#each [0, 1] as col (col)}<circle cx={2 + col * 4} cy={2 + row * 4} r="1.1" fill="currentColor" />{/each}{/each}</svg>
        </button>
        <ModeSwitch {mode} onmode={setMode} />
        <button type="button" class="icon" title="Undo (⌘Z)" onclick={() => toHost({ kind: ToHost.Undo })}><Undo2 size={14} /></button>
      </div>

      {#if barClosed && picked}
        <button type="button" class="pill" onclick={toggleBar} data-testid="selection-pill">&lt;{picked.tag}&gt; {fileName(picked.source)} · Edit</button>
      {/if}

      {#if problem || saved || warning}
        <div class="notice" class:bad={problem} data-testid="status">
          {#if problem}
            <span>{problem.text}</span>
            {#if problem.at}<button type="button" class="link" onclick={() => toHost({ kind: ToHost.Open, at: problem!.at! })}>Open in editor</button>{/if}
          {:else}
            <button type="button" class="link" onclick={() => toHost({ kind: ToHost.Open, at: saved! })}>{saved ? `Saved to ${fileName(saved)}` : ''}</button>
            {#if warning}<span class="warn">{warning}</span>{/if}
          {/if}
        </div>
      {/if}
    </div>
  </section>

  <aside class="right" class:closed={barClosed}>
    {#if picked}
      <div class="what" data-testid="selection">
        <Breadcrumb pick={picked} onselect={select} />
        {#if picked.component}<span class="component">in {picked.component.file.split('/').pop()}</span>{/if}
        <button type="button" class="link" onclick={() => toHost({ kind: ToHost.Open, at: picked!.source })}>{picked.source.file}:{picked.source.line}</button>
        <code class="classes">{picked.classes || 'no classes'}</code>
      </div>
      <Properties pick={picked} onpreview={preview} onchange={change} />
    {:else}
      <p class="empty">{bridged ? 'Click an element to edit it. Double-click text to rewrite it.' : 'The page has no Feega source map: element picking needs the feega-source-map plugin.'}</p>
    {/if}
  </aside>
</main>

<style>
  main {
    --float-gap: 16px;
    display: grid;
    height: 100vh;
    overflow: hidden;
    transition: grid-template-columns 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .view {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 40px;
    padding: 0 var(--ui-space-2);
    border-bottom: 1px solid var(--ui-divider);
    background: var(--ui-panel);
  }

  .icon {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    flex: none;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text-2);
    cursor: pointer;
  }

  .icon:hover:not(:disabled),
  .icon.on {
    background: var(--ui-input);
    color: var(--ui-text);
  }

  .icon:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .address {
    display: flex;
    flex: 1;
    align-items: center;
    gap: var(--ui-space-2);
    min-width: 120px;
    height: 28px;
    padding: 0 var(--ui-space-2);
    border-radius: var(--ui-radius-full);
    background: var(--ui-input);
  }

  .address input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-sm);
    outline: none;
  }

  .dot {
    width: 8px;
    height: 8px;
    flex: none;
    border-radius: var(--ui-radius-full);
  }

  .dot.grey {
    background: #8e8e93;
  }

  .dot.amber {
    background: #ff9f0a;
  }

  .dot.green {
    background: #30d158;
  }

  .dot.red {
    background: #ff453a;
  }

  .action,
  .device,
  .width {
    height: 24px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-sm);
  }

  .width {
    width: 64px;
    padding: 0 6px;
  }

  .zoom {
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }

  .backdrop {
    position: relative;
    display: flex;
    flex: 1;
    align-items: center;
    min-height: 0;
    justify-content: center;
    overflow: hidden;
    background: var(--ui-backdrop);
  }

  .frame {
    position: relative;
    flex: none;
    align-self: center;
    overflow: hidden;
    background: #fff;
  }

  .frame.framed {
    box-shadow: 0 0 0 1px var(--ui-divider), 0 8px 24px rgb(0 0 0 / 0.18);
  }

  iframe {
    display: block;
    border: 0;
    transform-origin: 0 0;
  }

  .overlay {
    position: absolute;
    inset: 0;
    cursor: crosshair;
  }

  .outline {
    position: absolute;
    pointer-events: none;
  }

  .hover {
    outline: 1px solid var(--ui-accent);
  }

  .picked {
    outline: 2px solid var(--ui-accent);
  }

  .picked .label {
    position: absolute;
    top: -18px;
    left: -2px;
    max-width: 320px;
    padding: 0 4px;
    border-radius: var(--ui-radius-xs);
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
    font-size: var(--ui-text-xs);
  }

  .handle {
    position: absolute;
    top: 50%;
    width: 6px;
    height: 48px;
    margin-top: -24px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-line-strong);
    cursor: ew-resize;
  }

  .handle:hover {
    background: var(--ui-accent);
  }

  .handle.left {
    left: -12px;
  }

  .handle.right {
    right: -12px;
  }

  .width-label {
    position: absolute;
    top: 8px;
    right: 8px;
    padding: 2px 6px;
    border-radius: var(--ui-radius-xs);
    background: var(--ui-float);
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
  }

  .width-label.live {
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
  }

  .float {
    position: fixed;
    z-index: 5;
    transition:
      left 180ms cubic-bezier(0.16, 1, 0.3, 1),
      top 180ms cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px;
    border-radius: var(--ui-radius-lg);
    background: var(--ui-float);
    box-shadow: 0 0 0 1px var(--ui-divider), 0 8px 24px rgb(0 0 0 / 0.22);
    backdrop-filter: blur(12px);
  }

  .float.moving {
    transition: none;
  }

  .grip {
    display: grid;
    place-items: center;
    width: 16px;
    height: 28px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: none;
    color: var(--ui-text);
    opacity: 0.5;
    cursor: grab;
    touch-action: none;
  }

  .float.moving .grip {
    cursor: grabbing;
  }

  .grip:focus-visible {
    opacity: 1;
    outline: 1px solid var(--ui-accent);
  }

  .pill {
    position: absolute;
    top: 12px;
    right: 12px;
    height: 28px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--ui-radius-full);
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
    font: inherit;
    font-size: var(--ui-text-sm);
    cursor: pointer;
  }

  .notice {
    position: absolute;
    bottom: 16px;
    left: 16px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-width: 280px;
    padding: 6px 10px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-float);
    box-shadow: 0 0 0 1px var(--ui-divider);
    font-size: var(--ui-text-sm);
  }

  .notice.bad {
    box-shadow: 0 0 0 1px #ff453a;
  }

  .warn {
    color: #ff9f0a;
  }

  .right {
    overflow: hidden auto;
    border-left: 1px solid var(--ui-divider);
    background: var(--ui-panel);
  }

  .right.closed {
    border: 0;
  }

  .what {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--ui-space-4);
    border-bottom: 1px solid var(--ui-divider);
    font-size: var(--ui-text-sm);
  }

  .component {
    color: var(--ui-text-2);
  }

  .link {
    padding: 0;
    border: 0;
    background: none;
    color: var(--ui-accent);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .classes {
    color: var(--ui-text-2);
    font-size: var(--ui-text-xs);
    word-break: break-word;
  }

  .empty {
    padding: var(--ui-space-4);
    color: var(--ui-text-2);
    font-size: var(--ui-text-sm);
  }
</style>
