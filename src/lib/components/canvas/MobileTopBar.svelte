<script lang="ts">
  import { BILLING_PATH } from '$lib/billing-path';
  import CreditAmount from '$lib/components/CreditAmount.svelte';
  import CanvasMenu from './CanvasMenu.svelte';
  import CanvasShare from './CanvasShare.svelte';
  import CanvasMobileSwitcher from './CanvasMobileSwitcher.svelte';
  import { pageMeta, pageTopActions } from '$lib/stores/page-meta';
  import type { ShareState } from '$lib/canvas/shared-view';
  import Megaphone from '@lucide/svelte/icons/megaphone';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import { canvasSelection, promotePath } from '$lib/canvas/promote-sheet';
  import { _ } from 'svelte-i18n';
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import { MOBILE_ICON } from '$lib/canvas/mobile-chrome';

  type CanvasShareProps = { shareToken: string | null; onShare: (state: ShareState) => Promise<void> };
  type ProjectRow = { id: string; name: string; href: string; updatedAt: string };
  type CanvasRow = { id: string; name: string; href: string };

  let {
    projectId,
    fallbackTitle,
    creditBalance,
    profile,
    org,
    share = null,
    projectName,
    brandName = null,
    projects,
    canvasName,
    canvasHref,
    canvases,
    backHref = null
  }: {
    projectId: string;
    fallbackTitle: string;
    creditBalance: number;
    profile: { name: string | null; email: string; avatarUrl: string | null };
    org: { name: string } | null;
    share?: CanvasShareProps | null;
    projectName: string;
    brandName?: string | null;
    projects: ProjectRow[];
    canvasName: string;
    canvasHref: string | null;
    canvases: CanvasRow[];
    backHref?: string | null;
  } = $props();

  const title = $derived($pageMeta.title ?? fallbackTitle);

  let switcherOpen = $state(false);
</script>

<header class="mobile-topbar" style:--mobile-icon="{MOBILE_ICON.size}px">
  <CanvasMenu {projectId} {profile} {org} {creditBalance} navigation="page" railPages="include" />
  {#if backHref}
    <a class="back" href={backHref} data-testid="mobile-back-to-canvas" aria-label={$_('app.shell.mobile.backToCanvas')}>
      <ArrowLeft size={MOBILE_ICON.size} strokeWidth={MOBILE_ICON.stroke} aria-hidden="true" />
      <span>{$_('app.shell.mobile.canvas')}</span>
    </a>
  {/if}
  <button type="button" class="title" data-testid="mobile-switch-trigger" onclick={() => (switcherOpen = true)}>
    <span class="truncate">{title}</span>
    <ChevronDown size={14} strokeWidth={MOBILE_ICON.stroke} class="chevron" />
  </button>
  <CanvasMobileSwitcher
    open={switcherOpen}
    onOpenChange={(open) => (switcherOpen = open)}
    {projectName}
    {brandName}
    {projects}
    {canvasName}
    {canvasHref}
    {canvases}
  />
  {#if $pageTopActions}
    <div class="actions">{@render $pageTopActions()}</div>
  {/if}
  {#if $canvasSelection.length}
    <a class="promote" aria-label="Promote" data-testid="mobile-promote" href={`/p/${projectId}${promotePath($canvasSelection)}`}>
      <Megaphone size={MOBILE_ICON.size} strokeWidth={MOBILE_ICON.stroke} />
    </a>
  {/if}
  {#if share}
    <CanvasShare shareToken={share.shareToken} onShare={share.onShare} />
  {/if}
  <a href={BILLING_PATH} class="credits">
    <CreditAmount amount={creditBalance} />
  </a>
</header>

<style>
  .mobile-topbar {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 0;
    height: calc(var(--mobile-topbar-h) + env(safe-area-inset-top, 0px));
    padding: env(safe-area-inset-top, 0px) max(4px, env(safe-area-inset-right, 0px)) 0
      max(4px, env(safe-area-inset-left, 0px));
    border-bottom: 1px solid var(--line, #ededef);
    background: var(--paper, #fff);
  }

  .promote {
    display: grid;
    place-items: center;
    width: var(--touch-target);
    height: var(--touch-target);
    flex-shrink: 0;
    color: var(--ink, #1d1d1f);
  }

  .mobile-topbar :global(.burger-btn),
  .mobile-topbar :global(.share-btn) {
    display: grid;
    place-items: center;
    width: var(--touch-target);
    height: var(--touch-target);
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ink, #1d1d1f);
    -webkit-tap-highlight-color: transparent;
  }
  .mobile-topbar :global(.burger-btn svg),
  .mobile-topbar :global(.share-btn svg) {
    width: var(--mobile-icon);
    height: var(--mobile-icon);
  }
  .mobile-topbar :global(.share-label) {
    display: none;
  }
  .mobile-topbar :global(.burger-btn:active),
  .mobile-topbar :global(.share-btn:active),
  .promote:active,
  .title:active,
  .back:active,
  .credits:active {
    background: var(--paper-3, #f4f4f4);
  }

  .title {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1 1 auto;
    min-width: 0;
    height: var(--touch-target);
    margin: 0;
    padding: 0 4px;
    appearance: none;
    border: none;
    background: transparent;
    font: inherit;
    font-size: 15px;
    font-weight: 600;
    color: var(--ink, #1d1d1f);
  }

  .title .truncate {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    min-width: 0;
  }

  .back {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    min-height: var(--touch-target);
    padding: 0 8px 0 4px;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    color: var(--ink, #1d1d1f);
    border-right: 1px solid var(--line, #ededef);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .credits {
    display: flex;
    align-items: center;
    min-height: var(--touch-target);
    padding: 0 10px;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    color: var(--ink, #1d1d1f);
  }
</style>
