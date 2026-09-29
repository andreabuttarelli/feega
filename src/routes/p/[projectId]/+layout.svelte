<script lang="ts">
  import '$lib/styles/tailwind.css';
  import { page } from '$app/state';
  import { onDestroy } from 'svelte';
  import CanvasTopBar from '$lib/components/canvas/CanvasTopBar.svelte';
  import FloatingRail from '$lib/components/canvas/FloatingRail.svelte';
  import CanvasChatPanel from '$lib/components/canvas/CanvasChatPanel.svelte';
  import CanvasSheet from '$lib/components/canvas/CanvasSheet.svelte';
  import CanvasMobileTabs from '$lib/components/canvas/CanvasMobileTabs.svelte';
  import CanvasMobileMore from '$lib/components/canvas/CanvasMobileMore.svelte';
  import { openSheet, restoreSheet } from '$lib/canvas/sheet-nav';
  import { CHROME_LOADERS } from '$lib/canvas/chrome-loaders';
  import MobileTopBar from '$lib/components/canvas/MobileTopBar.svelte';
  import DesktopPageBar from '$lib/components/canvas/DesktopPageBar.svelte';
  import { sheetEntryForPath, directLoadMode, activeMobileTab, type NavEntry, type MobileTab, type MobileView, type TabOutcome } from '$lib/shell-nav';
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
  let mobileMoreOpen = $state(false);
  let mobileView = $state<MobileView>('page');

  let isMobile = $state(browser ? matchMedia(MOBILE_QUERY).matches : false);
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

  const activeTab = $derived(activeMobileTab(projectId, page.url.pathname, mobileView));

  $effect(() => {
    void page.url.pathname;
    mobileView = 'page';
    mobileMoreOpen = false;
  });

  const MOBILE_TAB_ACTIONS: Record<MobileTab['id'], () => TabOutcome> = {
    canvas: () => {
      mobileView = 'page';
      return onCanvasRoute ? 'handled' : 'follow-link';
    },
    chat: () => {
      mobileView = 'chat';
      return 'handled';
    },
    calendar: () => {
      mobileView = 'page';
      return 'follow-link';
    },
    more: () => {
      mobileMoreOpen = true;
      return 'handled';
    }
  };

  function onMobileTab(tab: MobileTab): TabOutcome {
    return MOBILE_TAB_ACTIONS[tab.id]();
  }
</script>

<div class="project-shell" class:is-sheet-pending={sheetPending} data-viewport={viewport}>
  {#if isMobile}
    <MobileTopBar
      {projectId}
      fallbackTitle={onCanvasRoute ? (currentCanvas?.name ?? data.project.name) : data.project.name}
      creditBalance={data.creditBalance}
      profile={data.profile}
      org={data.org}
      share={onCanvasRoute ? { shareToken, onShare } : null}
      projectName={data.project.name}
      projects={data.projects.map((p: { id: string; name: string; href: string; updatedAt: string }) => ({
        id: p.id,
        name: p.name,
        href: p.href,
        updatedAt: p.updatedAt
      }))}
      canvasName={currentCanvas?.name ?? ''}
      canvasHref={currentCanvas?.href ?? null}
      canvases={data.canvases}
    />
    <main class="mobile-main" class:is-canvas={onCanvasRoute}>
      <div class="mobile-view" class:is-hidden={mobileView !== 'page'}>
        {@render children()}
      </div>
      {#if mobileView === 'chat'}
        <div class="mobile-chat">
          <CanvasChatPanel {projectId} brandSlug={data.brand?.slug ?? ''} open={true} />
        </div>
      {/if}
    </main>
    <CanvasMobileTabs {projectId} active={activeTab} onselect={onMobileTab} />
    <CanvasMobileMore {projectId} open={mobileMoreOpen} onOpenChange={(open) => (mobileMoreOpen = open)} />
  {:else if onCanvasRoute}
    <div class="canvas-row">
      <div class="canvas-stage">
        {@render children()}
        <CanvasTopBar
          {projectId}
          projectName={data.project.name}
          projects={data.projects.map((p: { id: string; name: string; href: string; updatedAt: string }) => ({
            id: p.id,
            name: p.name,
            href: p.href,
            updatedAt: p.updatedAt
          }))}
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
  .mobile-view.is-hidden {
    display: none;
  }
  .mobile-chat {
    position: absolute;
    inset: 0;
  }
</style>
