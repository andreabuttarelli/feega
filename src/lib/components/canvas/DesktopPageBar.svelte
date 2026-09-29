<script lang="ts">
  import ArrowLeft from '@lucide/svelte/icons/arrow-left';
  import CreditAmount from '$lib/components/CreditAmount.svelte';
  import CanvasMenu from './CanvasMenu.svelte';
  import { pageMeta, pageTopActions } from '$lib/stores/page-meta';

  let {
    projectId,
    canvasHref,
    fallbackTitle,
    creditBalance,
    profile,
    org
  }: {
    projectId: string;
    canvasHref: string;
    fallbackTitle: string;
    creditBalance: number;
    profile: { name: string | null; email: string; avatarUrl: string | null };
    org: { name: string } | null;
  } = $props();

  const title = $derived($pageMeta.title ?? fallbackTitle);
</script>

<header class="desktop-pagebar">
  <div class="pagebar-row">
    <CanvasMenu {projectId} {profile} {org} {creditBalance} navigation="page" />
    <a class="back" href={canvasHref}>
      <ArrowLeft size={16} aria-hidden="true" />
      <span>Canvas</span>
    </a>
    <span class="divider" aria-hidden="true"></span>
    <h1 class="title">{title}</h1>
    {#if $pageTopActions}
      <div class="actions">{@render $pageTopActions()}</div>
    {/if}
    <a href="/p/{projectId}/settings/billing" class="credits">
      <CreditAmount amount={creditBalance} />
    </a>
  </div>
  {#if $pageMeta.subtitle}
    <p class="subtitle">{$pageMeta.subtitle}</p>
  {/if}
</header>

<style>
  .desktop-pagebar {
    flex: 0 0 auto;
    border-bottom: 1px solid var(--line);
    background: var(--paper);
  }

  .pagebar-row {
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--shell-top-h);
    padding: 0 16px 0 8px;
  }

  .back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--ink-soft);
    text-decoration: none;
  }

  .back:hover {
    color: var(--ink);
    background: var(--paper-2);
  }

  .back:focus-visible,
  .credits:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .divider {
    width: 1px;
    height: 16px;
    background: var(--line);
  }

  .title {
    flex: 1 1 auto;
    min-width: 0;
    margin: 0 0 0 4px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--ink);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .credits {
    display: flex;
    align-items: center;
    height: 32px;
    padding: 0 8px;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
    color: var(--ink);
  }

  .subtitle {
    margin: 0;
    padding: 0 16px 12px;
    font-size: 13px;
    color: var(--ink-soft);
  }
</style>
