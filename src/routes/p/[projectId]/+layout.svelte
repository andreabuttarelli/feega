<script lang="ts">
  import { modeOf, ProjectMode } from '$lib/project-mode';
  import '$lib/styles/tailwind.css';
  import { page } from '$app/state';
  import { onDestroy, untrack } from 'svelte';
  import CanvasTopBar from '$lib/components/canvas/CanvasTopBar.svelte';
  import FloatingRail from '$lib/components/canvas/FloatingRail.svelte';
  import CanvasChatPanel from '$lib/components/canvas/CanvasChatPanel.svelte';
  import CanvasSheet from '$lib/components/canvas/CanvasSheet.svelte';
  import ChatLeaveGuard from '$lib/components/canvas/ChatLeaveGuard.svelte';
  import { openSheet, restoreSheet } from '$lib/canvas/sheet-nav';
  import { revealCanvas } from '$lib/canvas/canvas-reveal';
  import { CHROME_LOADERS } from '$lib/canvas/chrome-loaders';
  import MobileTopBar from '$lib/components/canvas/MobileTopBar.svelte';
  import MobileViewSwitch from '$lib/components/canvas/MobileViewSwitch.svelte';
  import { watchKeyboard } from '$lib/canvas/keyboard-inset';
  import DesktopPageBar from '$lib/components/canvas/DesktopPageBar.svelte';
  import { sheetEntryForPath, directLoadMode, type NavEntry } from '$lib/shell-nav';
  import { INITIAL_MOBILE_VIEW, chatBadge, showView, turnEnded, type MobileView, type ChatTurn } from '$lib/canvas/mobile-view';
  import { anyChatRunning } from '$lib/components/brand-agent/chat-session.svelte';
  import { MOBILE_QUERY, type Viewport } from '$lib/breakpoints';
  import { readChatOpen, writeChatOpen } from '$lib/shell-prefs';
  import { guideOpenRequest } from '$lib/canvas/guide-open';
  import { browser } from '$app/environment';
  import { deserialize } from '$app/forms';
  import type { ShareState } from '$lib/canvas/shared-view';

  let { data, children } = $props();

  const CANVAS_ROUTE_ID = '/p/[projectId]/c/[canvasId]';
  const onCanvasRoute = $derived(page.route.id === CANVAS_ROUTE_ID);

  const projectId = $derived(data.project.id);
  const canvasId = $derived(page.params.canvasId ?? '');
  const currentCanvas = $derived(data.canvases.find((c: { id: string }) => c.id === canvasId));
  const activeSheetId = $derived(page.state.sheet ? sheetEntryForPath(page.state.sheet.path)?.id ?? null : null);

  let leftPanel = $state<'assets' | 'brands' | 'influencers' | null>(null);
  let chatOpen = $state(browser ? readChatOpen() : true);
  let mobileView = $state(INITIAL_MOBILE_VIEW);

  let isMobile = $state(browser ? matchMedia(MOBILE_QUERY).matches : false);
  let typing = $state(false);
  if (browser) {
    onDestroy(watchKeyboard((open) => (typing = open)));
  }
  if (browser) {
    const mql = matchMedia(MOBILE_QUERY);
    const onChange = () => (isMobile = mql.matches);
    mql.addEventListener('change', onChange);
    onDestroy(() => mql.removeEventListener('change', onChange));
  }

  function toggleChat() {
    chatOpen = !chatOpen;
    writeChatOpen(chatOpen);
  }

  let shareWritten = $state<{ canvasId: string; token: string | null } | null>(null);
  const shareToken = $derived(
    shareWritten?.canvasId === canvasId ? shareWritten.token : ((page.data.shareToken as string | null | undefined) ?? null)
  );

  async function onShare(state: ShareState) {
    const body = new FormData();
    body.set('state', state);
    const res = await fetch(`/p/${projectId}/c/${canvasId}?/share_canvas`, { method: 'POST', body });
    const result = deserialize(await res.text());
    if (result.type !== 'success') {
      console.error('condivisione della tela fallita', result);
      return;
    }
    shareWritten = { canvasId, token: (result.data?.shareToken as string | null) ?? null };
  }

  $effect(() => {
    if ($guideOpenRequest) {
      chatOpen = true;
      writeChatOpen(true);
    }
  });

  function onRailPanel(entry: NavEntry) {
    leftPanel = leftPanel === entry.id ? null : (entry.id as 'assets' | 'brands' | 'influencers');
  }

  function onRailSheet(entry: NavEntry) {
    // Un `preloadData` fallito (rete, un `load` che lancia) non deve sparire senza traccia: chi
    // clicca vedrebbe la rail non fare niente, senza un solo indizio del perché.
    openSheet(projectId, entry.path).catch((err) => {
      console.error(`apertura del foglio "${entry.id}" fallita`, err);
    });
  }

  const viewport = $derived<Viewport>(isMobile ? 'mobile' : 'desktop');
  const innerPath = $derived(page.url.pathname.slice(`/p/${projectId}`.length));
  const sheetPending = $derived(
    !onCanvasRoute && !page.state.sheet && directLoadMode(innerPath, page.url.search, viewport) === 'sheet'
  );

  $effect(() => {
    if (!browser || !sheetPending) {
      return;
    }
    restoreSheet({
      canvasHref: data.canvases[0]?.href ?? `/p/${projectId}`,
      sheetHref: `${page.url.pathname}${page.url.search}`,
      path: innerPath,
      data: page.data
    }).catch((err) => console.error('apertura del foglio da link diretto fallita', err));
  });

  const chatTurn = $derived<ChatTurn>(anyChatRunning() ? 'running' : 'idle');
  let lastTurn: ChatTurn = 'idle';

  $effect(() => {
    if (lastTurn === 'running' && chatTurn === 'idle') {
      mobileView = untrack(() => turnEnded(mobileView));
    }
    lastTurn = chatTurn;
  });

  $effect(() => {
    void page.url.pathname;
    mobileView = untrack(() => showView(mobileView, 'canvas'));
  });

  function onMobileView(view: MobileView) {
    mobileView = showView(mobileView, view);
    if (view === 'canvas') {
      revealCanvas();
    }
  }

  const viewSwitch = $derived(
    onCanvasRoute ? { view: mobileView.view, badge: chatBadge(mobileView, chatTurn), onselect: onMobileView } : null
  );
</script>

<ChatLeaveGuard {projectId} />

<div class="project-shell" class:is-sheet-pending={sheetPending} class:is-nsfw={data.project.mode === ProjectMode.Nsfw} data-viewport={viewport} data-mode={data.project.mode}>
  {#if isMobile}
    <MobileTopBar
      {projectId}
      fallbackTitle={onCanvasRoute ? (currentCanvas?.name ?? data.project.name) : data.project.name}
      creditBalance={data.creditBalance}
      profile={data.profile}
      org={data.org}
      share={onCanvasRoute ? { shareToken, onShare } : null}
      projectName={data.project.name}
      projects={data.projects.filter((p: { mode: string }) => p.mode === data.project.mode).map((p: { id: string; name: string; href: string; updatedAt: string }) => ({
        id: p.id,
        name: p.name,
        href: p.href,
        updatedAt: p.updatedAt
      }))}
      canvasName={currentCanvas?.name ?? ''}
      canvasHref={currentCanvas?.href ?? null}
      canvases={data.canvases}
      backHref={onCanvasRoute ? null : (data.canvases[0]?.href ?? `/p/${projectId}`)}
    />
    <main class="mobile-main" class:is-canvas={onCanvasRoute} class:is-typing={typing}>
      <div class="mobile-view" class:is-hidden={mobileView.view === 'chat'}>
        {@render children()}
      </div>
      <div class="mobile-chat" class:is-hidden={mobileView.view !== 'chat'} data-testid="mobile-chat">
        <CanvasChatPanel {projectId} brandSlug={data.brand?.slug ?? ''} open={true} />
      </div>
      {#if viewSwitch && !typing}
        <MobileViewSwitch {...viewSwitch} />
      {/if}
    </main>
  {:else if onCanvasRoute}
    <div class="canvas-row">
      <div class="canvas-stage">
        {@render children()}
        <CanvasTopBar
          {projectId}
          projectName={data.project.name}
          projects={data.projects.map((p: { id: string; name: string; href: string; updatedAt: string; mode: string }) => ({
            id: p.id,
            name: p.name,
            href: p.href,
            updatedAt: p.updatedAt,
            mode: p.mode
          }))}
          projectMode={data.project.mode}
          nsfw={data.nsfw}
          canvasName={currentCanvas?.name ?? ''}
          canvasHref={currentCanvas?.href ?? ''}
          canvases={data.canvases}
          creditBalance={data.creditBalance}
          {chatOpen}
          onToggleChat={toggleChat}
          {shareToken}
          {onShare}
          profile={data.profile}
          org={data.org}
        />
        <FloatingRail
          activePanel={leftPanel}
          activeSheet={activeSheetId}
          onPanel={onRailPanel}
          onSheet={onRailSheet}
          mode={modeOf(data.project.mode)}
        />
        {#if browser && leftPanel}
          {#await CHROME_LOADERS.leftPanel() then { default: CanvasLeftPanel }}
            <CanvasLeftPanel
              {projectId}
              kind={leftPanel}
              labelKey={leftPanel === 'assets' ? 'app.nav2.materials' : leftPanel === 'brands' ? 'app.nav2.brands' : 'app.nav2.influencers'}
              onclose={() => (leftPanel = null)}
            />
          {/await}
        {/if}
        <CanvasSheet {projectId} />
      </div>

      <CanvasChatPanel {projectId} brandSlug={data.brand?.slug ?? ''} open={chatOpen} />
    </div>
  {:else}
    <DesktopPageBar
      {projectId}
      canvasHref={data.canvases[0]?.href ?? `/p/${projectId}`}
      fallbackTitle={data.project.name}
      creditBalance={data.creditBalance}
      profile={data.profile}
      org={data.org}
    />
    <main class="desktop-page">
      {@render children()}
    </main>
  {/if}
</div>

<style>
  .project-shell.is-nsfw {
    box-shadow: inset 0 3px 0 var(--color-destructive);
  }
  .project-shell {
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--paper-2, #f9f9f9);
  }

  .canvas-row {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
  }

  .canvas-stage {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  @media (min-width: 768px) {
    .project-shell.is-sheet-pending {
      visibility: hidden;
    }
  }

  .desktop-page {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: var(--content-pad-top) var(--content-pad-x) var(--content-pad-bottom);
  }

  .mobile-main {
    flex: 1 1 auto;
    min-height: 0;
    position: relative;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .mobile-main.is-canvas {
    overflow: hidden;
  }
  .mobile-main.is-canvas .mobile-view {
    height: 100%;
  }
  .mobile-main:not(.is-canvas) {
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .mobile-view.is-hidden {
    visibility: hidden;
  }
  .mobile-chat.is-hidden {
    display: none;
  }
  .mobile-chat {
    position: absolute;
    inset: 0;
    padding-bottom: var(--mobile-bar-clearance);
    background: var(--paper, #fff);
  }
  .mobile-main.is-typing .mobile-chat {
    padding-bottom: 0;
  }
</style>
