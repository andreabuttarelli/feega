<script lang="ts">
  import { ToHost, ToView, type Pick, type ViewMessage } from '../messages';
  import { fromHost, toHost } from './host';
  import { pageBridge, sourceText } from './page-bridge';
  import Properties from './Properties.svelte';
  import type { Row } from './controls';

  const RELOAD_MS = 400;

  let url = $state('');
  let status = $state('Waiting for the dev server…');
  let bridged = $state(false);
  let selecting = $state(true);
  let hover = $state<Pick | null>(null);
  let picked = $state<Pick | null>(null);
  let frame = $state<HTMLIFrameElement | null>(null);

  const bridge = pageBridge(() => frame, () => {
    bridged = true;
    status = '';
    refresh();
  });

  function refresh() {
    if (picked) {
      bridge.again(picked.source).then((p) => (picked = p ?? picked));
    }
  }

  const handlers: { [K in ToView]: (m: Extract<ViewMessage, { kind: K }>) => void } = {
    [ToView.App]: (m) => (url = m.url),
    [ToView.Status]: (m) => (status = m.text),
    [ToView.Edited]: (m) => {
      status = m.ok ? (m.written ? `Wrote ${m.written}` : '') : (m.reason ?? '');
      setTimeout(refresh, RELOAD_MS);
    },
    [ToView.Pick]: (m) => bridge.at(m.x, m.y).then((pick) => ((picked = pick), toHost({ kind: ToHost.Picked, id: m.id, pick })))
  };

  fromHost((m) => (handlers[m.kind] as (m: ViewMessage) => void)(m));
  toHost({ kind: ToHost.Ready });

  let moving = false;
  function onMove(e: PointerEvent) {
    if (moving) {
      return;
    }
    moving = true;
    bridge.at(e.offsetX, e.offsetY).then((p) => ((hover = p), (moving = false)));
  }

  async function onPick(e: MouseEvent) {
    picked = await bridge.at(e.offsetX, e.offsetY);
  }

  function preview(row: Row, value: string) {
    if (picked) {
      bridge.preview(picked.source, row.preview(value));
    }
  }

  function change(row: Row, value: string) {
    if (!picked) {
      return;
    }
    preview(row, value);
    const { prop, side, family, value: written } = row.change(value);
    toHost({ kind: ToHost.Edit, ask: { at: sourceText(picked.source), prop, side, family, value: written, rem: picked.rem, viewport: picked.viewport } });
  }

  function onKey(e: KeyboardEvent) {
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement;
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey && !typing) {
      e.preventDefault();
      toHost({ kind: ToHost.Undo });
    }
  }

  const box = (p: Pick) => `left:${p.rect.x}px;top:${p.rect.y}px;width:${p.rect.width}px;height:${p.rect.height}px`;
</script>

<svelte:window onkeydown={onKey} />

<main>
  <section class="stage">
    <header class="bar">
      <button type="button" class:on={selecting} onclick={() => (selecting = !selecting)} data-testid="select-mode">{selecting ? 'Selecting' : 'Interacting'}</button>
      <span class="url">{url}</span>
      <button type="button" onclick={() => toHost({ kind: ToHost.Undo })}>Undo</button>
    </header>
    <div class="page">
      {#if url}<iframe bind:this={frame} src={url} title="App" data-testid="app-frame"></iframe>{/if}
      {#if selecting && bridged}
        <div class="overlay" role="presentation" onpointermove={onMove} onpointerleave={() => (hover = null)} onclick={onPick}>
          {#if hover}<div class="outline hover" style={box(hover)}></div>{/if}
          {#if picked}<div class="outline picked" style={box(picked)}><span>{picked.tag}</span></div>{/if}
        </div>
      {/if}
      {#if status}<p class="status" data-testid="status">{status}</p>{/if}
    </div>
  </section>

  <aside class="right">
    {#if picked}
      <div class="what" data-testid="selection">
        <strong>&lt;{picked.tag}&gt;</strong>
        {#if picked.component}<span class="component">in {picked.component.file.split('/').pop()}</span>{/if}
        <button type="button" class="link" onclick={() => toHost({ kind: ToHost.Open, at: picked!.source })}>{picked.source.file}:{picked.source.line}</button>
        <code class="classes">{picked.classes || 'no classes'}</code>
      </div>
      <Properties pick={picked} onpreview={preview} onchange={change} />
    {:else}
      <p class="empty">{bridged ? 'Click an element to edit it.' : 'The page has no Feega source map: element picking needs the feega-source-map plugin.'}</p>
    {/if}
  </aside>
</main>

<style>
  main {
    display: grid;
    grid-template-columns: 1fr 260px;
    height: 100vh;
  }

  .stage {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: var(--ui-space-2);
    height: 36px;
    padding: 0 var(--ui-space-2);
    border-bottom: 1px solid var(--ui-divider);
  }

  .bar button {
    height: 24px;
    padding: 0 var(--ui-space-2);
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-input);
    color: var(--ui-text);
    font: inherit;
    font-size: var(--ui-text-sm);
  }

  .bar button.on {
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
  }

  .url {
    flex: 1;
    color: var(--ui-text-2);
    font-size: var(--ui-text-sm);
  }

  .page {
    position: relative;
    flex: 1;
    background: #fff;
  }

  iframe,
  .overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
  }

  .overlay {
    cursor: crosshair;
  }

  .outline {
    position: absolute;
    pointer-events: none;
    border-radius: 0;
  }

  .hover {
    outline: 1px solid var(--ui-accent);
  }

  .picked {
    outline: 2px solid var(--ui-accent);
  }

  .picked span {
    position: absolute;
    top: -18px;
    left: -2px;
    padding: 0 4px;
    border-radius: var(--ui-radius-xs);
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
    font-size: var(--ui-text-xs);
  }

  .status {
    position: absolute;
    bottom: var(--ui-space-2);
    left: var(--ui-space-2);
    margin: 0;
    padding: 4px 8px;
    border-radius: var(--ui-radius-md);
    background: var(--ui-panel);
    color: var(--ui-text);
    font-size: var(--ui-text-sm);
  }

  .right {
    overflow-y: auto;
    border-left: 1px solid var(--ui-divider);
    background: var(--ui-panel);
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
