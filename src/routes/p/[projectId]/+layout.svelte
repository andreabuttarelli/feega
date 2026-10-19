<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { modeOf, ProjectMode } from '$lib/project-mode';
  import '$lib/styles/tailwind.css';
  import { page } from '$app/state';
  import { onDestroy, untrack } from 'svelte';
  import CanvasTopBar from '$lib/components/canvas/CanvasTopBar.svelte';
  import FloatingRail from '$lib/components/canvas/FloatingRail.svelte';
  import type { LeftPanelKind } from '$lib/components/canvas/CanvasLeftPanel.svelte';
  import { inlineStage } from '$lib/canvas/inline-stage.svelte';
  import CanvasChatPanel from '$lib/components/canvas/CanvasChatPanel.svelte';
  import RightBar from '$lib/components/brand-agent/RightBar.svelte';
  import { can, OrgAction } from '$lib/org-roles';
  import CanvasSheet from '$lib/components/canvas/CanvasSheet.svelte';
  import ChatLeaveGuard from '$lib/components/canvas/ChatLeaveGuard.svelte';
  import { openSheet, restoreSheet } from '$lib/canvas/sheet-nav';
  import { revealCanvas } from '$lib/canvas/canvas-reveal';
  import { CHROME_LOADERS } from '$lib/canvas/chrome-loaders';
  import MobileTopBar from '$lib/components/canvas/MobileTopBar.svelte';
  import MobileViewSwitch from '$lib/components/canvas/MobileViewSwitch.svelte';
  import { watchKeyboard } from '$lib/canvas/keyboard-inset';
  import DesktopPageBar from '$lib/components/canvas/DesktopPageBar.svelte';
  import { NAV_ENTRIES, sheetEntryForPath, directLoadMode, navHref, type NavEntry } from '$lib/shell-nav';
  import { goto } from '$app/navigation';
  import { INITIAL_MOBILE_VIEW, chatBadge, showView, turnEnded, type MobileView, type ChatTurn } from '$lib/canvas/mobile-view';
  import { anyChatRunning } from '$lib/components/brand-agent/chat-session.svelte';
  import { MOBILE_QUERY, type Viewport } from '$lib/breakpoints';
  import { readChatOpen, writeChatOpen } from '$lib/shell-prefs';
  import { guideOpenRequest } from '$lib/canvas/guide-open';
  import { chatOpenRequest } from '$lib/canvas/empty-canvas';
  import { browser } from '$app/environment';
  import { postCanvasAction } from '$lib/canvas/canvas-api';
  import type { ShareState } from '$lib/canvas/shared-view';
  import { handoffOf } from '$lib/canvas/chat-handoff';
  import { editingLabel, propertiesRequest, propertiesTarget } from '$lib/canvas/phone-properties';
  import PhoneSheet from '$lib/components/canvas/PhoneSheet.svelte';
  import LayersPanel from '$lib/components/canvas/LayersPanel.svelte';
  import { Density } from '$lib/canvas/layer-density';
  import { PhoneSheetKind, phoneSheets } from '$lib/canvas/phone-sheets.svelte';
  import { Detent } from '$lib/motion/sheet-detents';

  let { data, children } = $props();

  const PHONE_SWITCH_PX = 64;
  const CANVAS_ROUTE_ID = '/p/[projectId]/c/[canvasId]';
  const onCanvasRoute = $derived(page.route.id === CANVAS_ROUTE_ID);

  const projectId = $derived(data.project.id);
  const canvasId = $derived(page.params.canvasId ?? '');
  const currentCanvas = $derived(data.canvases.find((c: { id: string }) => c.id === canvasId));
  const activeSheetId = $derived(page.state.sheet ? sheetEntryForPath(page.state.sheet.path)?.id ?? null : null);

  let leftPanel = $state<LeftPanelKind | null>(null);
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
    const result = await postCanvasAction({ projectId, canvasId }, 'share_canvas', body);
    if (result.type !== 'success') {
      console.error('condivisione della tela fallita', result);
      return;
    }
    shareWritten = { canvasId, token: (result.data?.shareToken as string | null) ?? null };
  }

  $effect(() => {
    if (!page.data.handoff || !handoffOf(page.url)) {
      return;
    }
    chatOpen = true;
    showMobile('chat');
  });

  $effect(() => {
    if ($guideOpenRequest) {
      chatOpen = true;
      writeChatOpen(true);
    }
  });

  $effect(() => {
    if (!$chatOpenRequest) {
      return;
    }
    chatOpen = true;
    writeChatOpen(true);
    showMobile('chat');
  });

  function onRailPanel(entry: NavEntry) {
    leftPanel = leftPanel === entry.id ? null : (entry.id as LeftPanelKind);
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
    showMobile('canvas');
  });

  const SHEET_OF: Record<MobileView, PhoneSheetKind | null> = { canvas: null, chat: PhoneSheetKind.Chat };

  function showMobile(view: MobileView) {
    untrack(() => {
      mobileView = showView(mobileView, view);
      phoneSheets.shown = SHEET_OF[view];
    });
  }

  $effect(() => {
    const chatShown = phoneSheets.shown === PhoneSheetKind.Chat;
    untrack(() => {
      if (chatShown !== (mobileView.view === 'chat')) {
        mobileView = showView(mobileView, chatShown ? 'chat' : 'canvas');
      }
    });
  });

  function onMobileView(view: MobileView) {
    showMobile(view);
    if (view === 'canvas') {
      revealCanvas();
    }
  }

  function openProperties() {
    const target = $propertiesTarget;
    if (!target) {
      return;
    }
    onMobileView('canvas');
    propertiesRequest.set(target.id);
  }

  const viewSwitch = $derived(
    onCanvasRoute && !inlineStage.editing ? { view: mobileView.view, badge: chatBadge(mobileView, chatTurn), onselect: onMobileView, properties: { target: $propertiesTarget?.name ?? null, onopen: openProperties }, layers: phoneSheets.shown === PhoneSheetKind.Layers, onlayers: () => phoneSheets.toggle(PhoneSheetKind.Layers), inserting: phoneSheets.shown === PhoneSheetKind.Insert, oninsert: () => phoneSheets.toggle(PhoneSheetKind.Insert) } : null
  );

  const canEdit = $derived(can(data.org.role, OrgAction.Edit));
</script>

<ChatLeaveGuard {projectId} />
{#if browser}<RightBar {projectId} viewOnly={!canEdit} />{/if}

<div class="project-shell safe-shell ui-app" class:is-editing={inlineStage.editing} class:is-sheet-pending={sheetPending} class:is-uncensored={data.project.mode === ProjectMode.Uncensored} data-viewport={viewport} data-safe={isMobile ? 'sides' : undefined} data-mode={data.project.mode}>
  {#if isMobile}
    <MobileTopBar
      {projectId}
      fallbackTitle={onCanvasRoute ? (currentCanvas?.name ?? data.project.name) : data.project.name}
      creditBalance={data.creditBalance}
      profile={data.profile}
      org={data.org}
      share={onCanvasRoute ? { shareToken, onShare } : null}
      projectName={data.project.name}
      brandName={data.brand?.name ?? null}
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
      <div class="mobile-view">
        {@render children()}
      </div>
      <PhoneSheet name="canvas-chat" title={$_('app.shell.mobile.chat')} open={mobileView.view === 'chat'} onclose={() => onMobileView('canvas')} floorPx={typing ? 0 : PHONE_SWITCH_PX} opensAt={Detent.Full} testid="mobile-chat">
        <CanvasChatPanel open={true} />
        {#if $propertiesTarget}<span class="editing" data-testid="canvas-chat-editing">{editingLabel($propertiesTarget.name)}</span>{/if}
      </PhoneSheet>
      {#if onCanvasRoute}
        <PhoneSheet name="canvas-layers" title={$_('app.nav2.layers')} open={phoneSheets.shown === PhoneSheetKind.Layers} onclose={() => phoneSheets.close(PhoneSheetKind.Layers)} floorPx={PHONE_SWITCH_PX} testid="mobile-layers">
          <LayersPanel density={Density.Touch} />
        </PhoneSheet>
      {/if}
      {#if viewSwitch && !typing}
        <MobileViewSwitch {...viewSwitch} />
      {/if}
    </main>
  {:else if onCanvasRoute}
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
      brandName={data.brand?.name ?? null}
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
    <div class="canvas-row">
      <FloatingRail
        activePanel={leftPanel}
        activeSheet={activeSheetId}
        onPanel={onRailPanel}
        onSheet={onRailSheet}
        onRoute={(entry) => goto(navHref(projectId, entry))}
        mode={modeOf(data.project.mode)}
      />
      {#if browser && leftPanel}
        {#await CHROME_LOADERS.leftPanel() then { default: CanvasLeftPanel }}
          <CanvasLeftPanel
            {projectId}
            kind={leftPanel}
            labelKey={NAV_ENTRIES.find((entry) => entry.id === leftPanel)?.labelKey ?? ''}
            onclose={() => (leftPanel = null)}
            onkind={(kind) => (leftPanel = kind)}
          />
        {/await}
      {/if}
      <div class="canvas-stage">
        {@render children()}
        <CanvasSheet {projectId} />
      </div>

      <CanvasChatPanel open={chatOpen && !inlineStage.editing} />
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
  .project-shell.is-uncensored {
    box-shadow: inset 0 3px 0 var(--color-destructive);
  }
  .project-shell.is-editing :global(.mobile-topbar) {
    display: none;
  }

  .project-shell {
    height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--ui-bg);
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
    --mobile-stack-top: calc(var(--mobile-bar-clearance) + var(--mobile-stack-gap));
  }
  .project-shell.is-editing .mobile-main :global(.runs),
  .project-shell.is-editing .mobile-main :global(.save-status) {
    display: none;
  }
  .mobile-main.is-canvas .mobile-view {
    height: 100%;
  }
  .mobile-main:not(.is-canvas) {
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
  .editing {
    order: -1;
    align-self: center;
    max-width: calc(100% - 32px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 2px 10px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-accent-wash);
    color: var(--ui-accent);
    font-size: var(--ui-text-xs);
    font-weight: 500;
  }
</style>
