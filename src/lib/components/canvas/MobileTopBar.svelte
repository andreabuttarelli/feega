<script lang="ts">
  import CreditAmount from '$lib/components/CreditAmount.svelte';
  import CanvasMenu from './CanvasMenu.svelte';
  import CanvasShare from './CanvasShare.svelte';
  import CanvasMobileSwitcher from './CanvasMobileSwitcher.svelte';
  import { pageMeta, pageTopActions } from '$lib/stores/page-meta';
  import type { ShareState } from '$lib/canvas/shared-view';
  import Megaphone from '@lucide/svelte/icons/megaphone';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import { canvasSelection, promotePath } from '$lib/canvas/promote-sheet';
  import { openSheet } from '$lib/canvas/sheet-nav';

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
    projects,
    canvasName,
    canvases
  }: {
    projectId: string;
    fallbackTitle: string;
    creditBalance: number;
    profile: { name: string | null; email: string; avatarUrl: string | null };
    org: { name: string } | null;
    share?: CanvasShareProps | null;
    projectName: string;
    projects: ProjectRow[];
    canvasName: string;
    canvases: CanvasRow[];
  } = $props();

  const title = $derived($pageMeta.title ?? fallbackTitle);

  let switcherOpen = $state(false);
</script>

<header class="mobile-topbar">
  <CanvasMenu {projectId} {profile} {org} {creditBalance} navigation="page" />
  <button type="button" class="title" data-testid="mobile-switch-trigger" onclick={() => (switcherOpen = true)}>
    <span class="truncate">{title}</span>
    <ChevronDown size={14} />
  </button>
  <CanvasMobileSwitcher
    open={switcherOpen}
    onOpenChange={(open) => (switcherOpen = open)}
    {projectName}
    {projects}
    {canvasName}
    {canvases}
  />
  {#if $pageTopActions}
    <div class="actions">{@render $pageTopActions()}</div>
  {/if}
  {#if $canvasSelection.length}
    <button
      type="button"
      class="promote"
      aria-label="Promote"
      data-testid="mobile-promote"
      onclick={() => openSheet(projectId, promotePath($canvasSelection))}
    >
      <Megaphone size={18} />
    </button>
  {/if}
  {#if share}
    <CanvasShare shareToken={share.shareToken} onShare={share.onShare} />
  {/if}
  <a href="/p/{projectId}/settings/billing" class="credits">
    <CreditAmount amount={creditBalance} />
  </a>
</header>

<style>
  .mobile-topbar {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 4px;
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
    border: none;
    background: transparent;
    color: var(--ink, #1d1d1f);
  }

  .mobile-topbar :global(.burger-btn) {
    width: var(--touch-target);
    height: var(--touch-target);
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
