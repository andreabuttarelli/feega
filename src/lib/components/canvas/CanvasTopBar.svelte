<script lang="ts">
  import { _ } from 'svelte-i18n';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
  import { cn } from '$lib/utils';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import Check from '@lucide/svelte/icons/check';
  import MessageSquare from '@lucide/svelte/icons/message-square';
  import CreditAmount from '$lib/components/CreditAmount.svelte';
  import CanvasMenu from './CanvasMenu.svelte';
  import CanvasShare from './CanvasShare.svelte';
  import type { ShareState } from '$lib/canvas/shared-view';
  import { openSheet } from '$lib/canvas/sheet-nav';
  import Megaphone from '@lucide/svelte/icons/megaphone';
  import { canvasSelection, promotePath } from '$lib/canvas/promote-sheet';
  import { formatLastEdited } from '$lib/canvas/format-last-edited';
  import { CanvasAction, submitCanvasAction, renameProjectAction } from '$lib/canvas/canvas-list';
  import Plus from '@lucide/svelte/icons/plus';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Trash from '@lucide/svelte/icons/trash-2';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

  type ProjectRow = { id: string; name: string; href: string; updatedAt: string };
  type CanvasRow = { id: string; name: string; href: string };

  /**
   * IL SELETTORE IN ALTO A SINISTRA: `[Project ▾ / Canvas ▾]`. Due menu indipendenti, non uno
   * annidato — cambiare progetto e cambiare tela sono due decisioni diverse, e un progetto nuovo
   * non deve costringere a scegliere anche una tela nella stessa tendina.
   *
   * DUE RIQUADRI GALLEGGIANTI, non una barra a tutta larghezza: fra loro la tela resta cliccabile
   * — è per questo che `.canvas-topbar` è `pointer-events: none` e solo i due `.top-box` tornano
   * `auto`.
   */
  let {
    projectId,
    projectName,
    projects,
    canvasName,
    canvasHref,
    canvases,
    creditBalance,
    chatOpen,
    onToggleChat,
    shareToken,
    onShare,
    profile,
    org
  }: {
    projectId: string;
    projectName: string;
    projects: ProjectRow[];
    canvasName: string;
    canvasHref: string;
    canvases: CanvasRow[];
    creditBalance: number;
    chatOpen: boolean;
    onToggleChat: () => void;
    shareToken: string | null;
    onShare: (state: ShareState) => Promise<void>;
    profile: { name: string | null; email: string; avatarUrl: string | null };
    org: { name: string } | null;
  } = $props();

  let renaming = $state(false);
  let draftName = $state('');
  let confirmingDelete = $state(false);
  const lastCanvas = $derived(canvases.length <= 1);

  let renamingProject = $state(false);
  let draftProjectName = $state('');

  function startRename() {
    draftName = canvasName;
    renaming = true;
  }

  async function saveRename(event: SubmitEvent) {
    event.preventDefault();
    renaming = false;
    await submitCanvasAction(canvasHref, CanvasAction.Rename, { name: draftName });
  }

  function startRenameProject() {
    draftProjectName = projectName;
    renamingProject = true;
  }

  async function saveRenameProject(event: SubmitEvent) {
    event.preventDefault();
    renamingProject = false;
    await renameProjectAction(canvasHref, draftProjectName);
  }

  function askDeleteCurrent() {
    if (lastCanvas) {
      return;
    }
    confirmingDelete = true;
  }

  async function deleteCurrent() {
    await submitCanvasAction(canvasHref, CanvasAction.Delete);
  }

  function openBilling() {
    openSheet(projectId, '/settings/billing').catch((err) => {
      console.error('apertura del foglio "billing" fallita', err);
    });
  }
</script>

<header class="canvas-topbar">
  <div class="top-box left">
    <CanvasMenu {projectId} {profile} {org} {creditBalance} />

    {#if renamingProject}
      <form class="rename-form" onsubmit={saveRenameProject}>
        <input
          class="rename-input"
          data-testid="project-rename-input"
          bind:value={draftProjectName}
          {@attach (el) => el.focus()}
          onkeydown={(e) => e.key === 'Escape' && (renamingProject = false)}
        />
        <button type="submit" class="rename-save">{$_('app.shell.canvasActions.save')}</button>
      </form>
    {:else}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger class="switcher-btn" data-testid="project-switcher">
        <span class="truncate">{projectName}</span>
        <ChevronDown size={13} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" class="w-64">
        {#each projects as project (project.id)}
          <DropdownMenu.Item>
            {#snippet child({ props })}
              <a {...props} href={project.href} class="switcher-row">
                <span class="truncate">{project.name}</span>
                <span class="switcher-meta">{formatLastEdited(project.updatedAt)}</span>
                {#if project.name === projectName}
                  <Check size={14} />
                {/if}
              </a>
            {/snippet}
          </DropdownMenu.Item>
        {/each}
        <DropdownMenu.Separator />
        <DropdownMenu.Item data-testid="project-rename" onSelect={startRenameProject}>
          <Pencil size={14} />
          {$_('app.shell.canvasActions.rename')}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
    {/if}

    <span class="sep">/</span>

    {#if renaming}
      <form class="rename-form" onsubmit={saveRename}>
        <input
          class="rename-input"
          data-testid="canvas-rename-input"
          bind:value={draftName}
          {@attach (el) => el.focus()}
          onkeydown={(e) => e.key === 'Escape' && (renaming = false)}
        />
        <button type="submit" class="rename-save">{$_('app.shell.canvasActions.save')}</button>
      </form>
    {:else}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger class="switcher-btn" data-testid="canvas-switcher">
        <span class="truncate canvas-name">{canvasName}</span>
        <ChevronDown size={13} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" class="w-64">
        {#each canvases as canvas (canvas.id)}
          <DropdownMenu.Item>
            {#snippet child({ props })}
              <a {...props} href={canvas.href} class="switcher-row">
                <span class="truncate">{canvas.name}</span>
                {#if canvas.name === canvasName}
                  <Check size={14} />
                {/if}
              </a>
            {/snippet}
          </DropdownMenu.Item>
        {/each}
        <DropdownMenu.Separator />
        <DropdownMenu.Item data-testid="canvas-new" onSelect={() => submitCanvasAction(canvasHref, CanvasAction.New)}>
          <Plus size={14} />
          {$_('app.shell.canvasActions.new')}
        </DropdownMenu.Item>
        <DropdownMenu.Item data-testid="canvas-rename" onSelect={startRename}>
          <Pencil size={14} />
          {$_('app.shell.canvasActions.rename')}
        </DropdownMenu.Item>
        <DropdownMenu.Item
          data-testid="canvas-delete"
          disabled={lastCanvas}
          title={lastCanvas ? $_('app.shell.canvasActions.lastCanvas') : undefined}
          onSelect={askDeleteCurrent}
        >
          <Trash size={14} />
          {$_('app.shell.canvasActions.delete')}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
    {/if}
  </div>

  <ConfirmDialog
    bind:open={confirmingDelete}
    title={$_('app.shell.canvasActions.confirmDeleteTitle')}
    body={$_('app.shell.canvasActions.confirmDeleteBody')}
    confirmLabel={$_('app.shell.canvasActions.confirmDeleteCta')}
    cancelLabel={$_('app.shell.canvasActions.confirmDeleteCancel')}
    onConfirm={deleteCurrent}
  />

  <div class="top-box right">
    <a href="#billing" class="credits" onclick={(e) => { e.preventDefault(); openBilling(); }}>
      <CreditAmount amount={creditBalance} />
    </a>

    <button
      type="button"
      class="promote-btn"
      data-testid="topbar-promote"
      onclick={() => openSheet(projectId, promotePath($canvasSelection))}
    >
      <Megaphone size={14} />
      Promote
    </button>

    <CanvasShare {shareToken} {onShare} />

    <button
      type="button"
      class={cn('chat-toggle', chatOpen && 'is-active')}
      aria-pressed={chatOpen}
      aria-label={$_(chatOpen ? 'app.shell.collapseChat' : 'app.shell.expandChat')}
      onclick={onToggleChat}
    >
      <MessageSquare size={16} />
    </button>
  </div>
</header>

<style>
  .canvas-topbar {
    position: absolute;
    z-index: 20;
    top: 0;
    left: 0;
    right: 0;
    pointer-events: none;
  }

  .top-box {
    position: absolute;
    top: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 44px;
    padding: 0 4px;
    background: var(--paper, #fff);
    border: 1px solid var(--line-2, #d2d2d7);
    box-shadow: 0 4px 18px rgb(0 0 0 / 0.1);
    pointer-events: auto;
  }

  .top-box.left {
    left: 8px;
    max-width: calc(100vw - 16px);
  }

  .top-box.right {
    right: 8px;
  }

  .sep {
    color: var(--ink-faint, #9a9a9e);
  }

  :global(.switcher-btn) {
    display: flex;
    align-items: center;
    gap: 5px;
    max-width: 220px;
    appearance: none;
    border: 0;
    background: transparent;
    padding: 5px 6px;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink, #1d1d1f);
    cursor: pointer;
  }
  :global(.switcher-btn:hover) {
    background: var(--paper-2, #f9f9f9);
  }

  .rename-form {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .rename-input {
    width: 180px;
    border: 1px solid var(--line, #e5e5e7);
    padding: 4px 6px;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink, #1d1d1f);
    background: var(--paper, #fff);
  }

  .rename-save {
    border: 1px solid var(--ink, #1d1d1f);
    background: var(--ink, #1d1d1f);
    color: var(--paper, #fff);
    padding: 4px 8px;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .switcher-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    text-decoration: none;
    color: inherit;
  }

  .switcher-meta {
    font-size: 11px;
    font-weight: 400;
    color: var(--ink-faint, #9a9a9e);
    white-space: nowrap;
  }

  .chat-toggle {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    appearance: none;
    border: 1px solid var(--line, #ededef);
    background: var(--paper, #fff);
    color: var(--ink-soft, #6e6e73);
    cursor: pointer;
  }
  .chat-toggle:hover {
    background: var(--paper-2, #f9f9f9);
  }
  .chat-toggle.is-active {
    background: var(--nav-on, color-mix(in srgb, var(--accent) 12%, transparent));
    color: var(--accent-ink, var(--accent, #7c5cff));
  }


  .promote-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 10px;
    flex-shrink: 0;
    border: 1px solid var(--ink, #1d1d1f);
    background: var(--ink, #1d1d1f);
    color: var(--paper, #fff);
    font: inherit;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
  }

  .credits {
    display: inline-flex;
    flex-shrink: 0;
    padding: 3px 7px;
    font-size: 11px;
    font-weight: 600;
    color: var(--ink-soft, #6e6e73);
    background: var(--paper, #fff);
    border: 1px solid var(--line, #ededef);
    text-decoration: none;
  }
  .credits:hover {
    color: var(--ink, #1d1d1f);
    background: var(--paper-2, #f9f9f9);
  }

  @media (max-width: 480px) {
    .canvas-name {
      max-width: 80px;
    }
  }
</style>
