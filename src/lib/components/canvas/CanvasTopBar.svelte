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
  import { BILLING_PATH } from '$lib/billing-path';
  import Megaphone from '@lucide/svelte/icons/megaphone';
  import { canvasSelection, promotePath } from '$lib/canvas/promote-sheet';
  import { formatLastEdited } from '$lib/canvas/format-last-edited';
  import { CanvasAction, submitCanvasAction, renameProjectAction } from '$lib/canvas/canvas-list';
  import Plus from '@lucide/svelte/icons/plus';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Trash from '@lucide/svelte/icons/trash-2';
  import Search from '@lucide/svelte/icons/search';
  import Ellipsis from '@lucide/svelte/icons/ellipsis';
  import { UNCENSORED_NOTICE } from '$lib/uncensored-lock';
  import { DropdownMenu as MenuPrimitive } from 'bits-ui';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { matching, needsSearch, recentFirst } from '$lib/canvas/switcher-list';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import { Capability, modeAllows, modeOf, ProjectMode } from '$lib/project-mode';

  type ProjectRow = { id: string; name: string; href: string; updatedAt: string; mode?: string };
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
    org,
    projectMode = ProjectMode.Standard,
    brandName = null
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
    projectMode?: string;
    brandName?: string | null;
  } = $props();

  const ICON = 16;
  const EDGE = 8;


  let projectQuery = $state('');
  let searchInput = $state<HTMLInputElement | null>(null);
  const projectSearch = $derived(needsSearch(projects.length));
  const shownProjects = $derived(matching(recentFirst(projects), projectQuery));

  function focusSearch(event: Event) {
    if (!searchInput) {
      return;
    }
    event.preventDefault();
    searchInput.focus();
  }

  function firstProjectLink(): HTMLElement | null {
    return searchInput?.closest('[data-slot="dropdown-menu-content"]')?.querySelector<HTMLElement>('[data-sw-link]') ?? null;
  }

  function searchKeys(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      firstProjectLink()?.focus();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      firstProjectLink()?.click();
      return;
    }
    if (event.key !== 'Escape' && event.key !== 'Tab') {
      event.stopPropagation();
    }
  }
  const inUncensored = $derived(projectMode === ProjectMode.Uncensored);
  const mode = $derived(modeOf(projectMode));

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
    <DropdownMenu.Root onOpenChange={() => (projectQuery = '')}>
      <DropdownMenu.Trigger class="switcher-btn" data-testid="project-switcher" title={projectName}>
        {#if inUncensored}
          <span class="uncensored-badge" data-testid="uncensored-project-badge" title={UNCENSORED_NOTICE}>Uncensored</span>
        {/if}
        <span class="truncate">{projectName}</span>
        <ChevronDown size={ICON} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" collisionPadding={EDGE} class="sw-menu w-[300px]" onOpenAutoFocus={focusSearch}>
        {#if projectSearch}
          <div class="sw-search">
            <Search size={ICON} />
            <input
              bind:this={searchInput}
              bind:value={projectQuery}
              data-testid="project-search"
              placeholder={$_('app.shell.canvasActions.searchProjects')}
              onkeydown={searchKeys}
            />
          </div>
        {/if}
        <DropdownMenu.Label class="sw-label">{$_('app.shell.mobile.projects')}</DropdownMenu.Label>
        {#each shownProjects as project (project.id)}
          {@render projectRow(project)}
        {:else}
          <div class="sw-empty">{$_('app.shell.canvasActions.noMatch')}</div>
        {/each}
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
      <DropdownMenu.Trigger class="switcher-btn" data-testid="canvas-switcher" title={canvasName}>
        <span class="truncate canvas-name">{canvasName}</span>
        <ChevronDown size={ICON} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" collisionPadding={EDGE} class="sw-menu w-[300px]">
        <div class="sw-head">
          <span class="sw-head-name" title={projectName}>{projectName}</span>
          {#if brandName}
            <Badge variant="outline" data-testid="switcher-brand">{brandName}</Badge>
          {/if}
        </div>
        <DropdownMenu.Label class="sw-label">{$_('app.shell.mobile.canvases')}</DropdownMenu.Label>
        {#each canvases as canvas (canvas.id)}
          {@const current = canvas.name === canvasName}
          <div class={cn('sw-line', current && 'is-current')} data-testid={current ? 'canvas-row-current' : undefined}>
            <DropdownMenu.Item class="sw-row">
              {#snippet child({ props })}
                <a {...props} href={canvas.href} title={canvas.name}>
                  <span class="sw-lead">{#if current}<Check size={ICON} />{/if}</span>
                  <span class="sw-name">{canvas.name}</span>
                </a>
              {/snippet}
            </DropdownMenu.Item>
            {#if current}
              <DropdownMenu.Item
                class="sw-icon"
                data-testid="canvas-rename"
                aria-label={$_('app.shell.canvasActions.rename')}
                title={$_('app.shell.canvasActions.rename')}
                onSelect={startRename}
              >
                <Pencil size={ICON} />
              </DropdownMenu.Item>
              <DropdownMenu.Sub>
                <MenuPrimitive.SubTrigger
                  class="sw-icon sw-more"
                  data-testid="canvas-more"
                  aria-label={$_('app.shell.canvasActions.more')}
                  title={$_('app.shell.canvasActions.more')}
                >
                  <Ellipsis size={ICON} />
                </MenuPrimitive.SubTrigger>
                <DropdownMenu.SubContent class="sw-menu w-44" collisionPadding={EDGE}>
                  <DropdownMenu.Item class="sw-row" onSelect={startRename}>
                    <span class="sw-lead"><Pencil size={ICON} /></span>
                    {$_('app.shell.canvasActions.rename')}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    class="sw-row"
                    variant="destructive"
                    data-testid="canvas-delete"
                    disabled={lastCanvas}
                    title={lastCanvas ? $_('app.shell.canvasActions.lastCanvas') : undefined}
                    onSelect={askDeleteCurrent}
                  >
                    <span class="sw-lead"><Trash size={ICON} /></span>
                    {$_('app.shell.canvasActions.delete')}
                  </DropdownMenu.Item>
                </DropdownMenu.SubContent>
              </DropdownMenu.Sub>
            {/if}
          </div>
        {/each}
        <DropdownMenu.Separator />
        <DropdownMenu.Item class="sw-row" data-testid="canvas-new" onSelect={() => submitCanvasAction(canvasHref, CanvasAction.New)}>
          <span class="sw-lead"><Plus size={ICON} /></span>
          {$_('app.shell.canvasActions.new')}
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
    {/if}
  </div>

  {#snippet projectRow(project: ProjectRow)}
    {@const current = project.id === projectId}
    <div class={cn('sw-line', current && 'is-current')} data-testid={current ? 'project-row-current' : undefined}>
      <DropdownMenu.Item class="sw-row">
        {#snippet child({ props })}
          <a {...props} href={project.href} title={project.name} data-sw-link>
            <span class="sw-lead">{#if current}<Check size={ICON} />{/if}</span>
            <span class="sw-name">{project.name}</span>
            {#if project.mode === ProjectMode.Uncensored}<span class="uncensored-badge" title={UNCENSORED_NOTICE}>Uncensored</span>{/if}
            <span class="sw-meta">{formatLastEdited(project.updatedAt)}</span>
          </a>
        {/snippet}
      </DropdownMenu.Item>
      {#if current}
        <DropdownMenu.Item
          class="sw-icon"
          data-testid="project-rename"
          aria-label={$_('app.shell.canvasActions.renameProject')}
          title={$_('app.shell.canvasActions.renameProject')}
          onSelect={startRenameProject}
        >
          <Pencil size={ICON} />
        </DropdownMenu.Item>
      {/if}
    </div>
  {/snippet}

  <ConfirmDialog
    bind:open={confirmingDelete}
    title={$_('app.shell.canvasActions.confirmDeleteTitle')}
    body={$_('app.shell.canvasActions.confirmDeleteBody')}
    confirmLabel={$_('app.shell.canvasActions.confirmDeleteCta')}
    cancelLabel={$_('app.shell.canvasActions.confirmDeleteCancel')}
    onConfirm={deleteCurrent}
  />

  <div class="top-box right">
    <a href={BILLING_PATH} class="credits">
      <CreditAmount amount={creditBalance} />
    </a>

    {#if modeAllows(mode, Capability.Promote)}
      <button
        type="button"
        class="promote-btn"
        data-testid="topbar-promote"
        onclick={() => openSheet(projectId, promotePath($canvasSelection))}
      >
        <Megaphone size={14} />
        Promote
      </button>
    {/if}

    {#if modeAllows(mode, Capability.Share)}
      <CanvasShare {shareToken} {onShare} />
    {/if}

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
    border: 1px solid var(--ui-accent);
    background: var(--ui-accent);
    color: var(--ui-accent-ink);
    padding: 4px 8px;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
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
    border: 1px solid var(--ui-line-strong);
    background: var(--ui-bg);
    color: var(--ui-ink);
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
  .uncensored-badge {
    border: 1px solid var(--color-destructive);
    color: var(--color-destructive);
    padding: 0 0.25rem;
    font-size: 0.625rem;
    line-height: 1rem;
  }

  :global(.sw-menu) {
    --sw-row: 32px;
    --sw-icon: 16px;
    max-width: calc(100vw - 16px);
    max-height: min(480px, var(--bits-dropdown-menu-content-available-height, 480px));
    padding: 4px;
    font-size: 13px;
    color: var(--ink, #1d1d1f);
  }
  :global(.sw-head) {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 8px 8px 6px;
  }
  :global(.sw-head-name) {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-weight: 600;
  }

  :global(.sw-label) {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 8px 4px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--ink-faint, #9a9a9e);
  }
  :global(.sw-search) {
    position: sticky;
    top: -4px;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--sw-row);
    margin: -4px -4px 4px;
    padding: 0 12px;
    background: var(--paper, #fff);
    border-bottom: 1px solid var(--line, #ededef);
    color: var(--ink-faint, #9a9a9e);
  }
  :global(.sw-search input) {
    flex: 1 1 auto;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    font: inherit;
    color: var(--ink, #1d1d1f);
  }

  :global(.sw-line) {
    display: flex;
    align-items: center;
  }
  :global(.sw-line.is-current) {
    background: var(--paper-3, #efeff1);
  }

  :global(.sw-row) {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 8px;
    min-width: 0;
    height: var(--sw-row);
    padding: 0 8px;
    font-size: 13px;
    color: inherit;
    text-decoration: none;
    cursor: pointer;
  }
  :global(.sw-line.is-current .sw-row) {
    font-weight: 600;
  }

  :global(.sw-lead) {
    display: grid;
    place-items: center;
    width: var(--sw-icon);
    flex-shrink: 0;
  }

  :global(.sw-name) {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  :global(.sw-meta) {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 400;
    color: var(--ink-faint, #9a9a9e);
    font-variant-numeric: tabular-nums;
  }

  :global(.sw-icon) {
    display: grid;
    place-items: center;
    width: var(--sw-row);
    height: var(--sw-row);
    flex-shrink: 0;
    color: var(--ink-soft, #6e6e73);
    cursor: pointer;
    outline: none;
    opacity: 0;
  }
  :global(.sw-line:hover .sw-icon),
  :global(.sw-line:focus-within .sw-icon),
  :global(.sw-icon[data-state='open']) {
    opacity: 1;
  }
  :global(.sw-icon:hover),
  :global(.sw-icon[data-highlighted]),
  :global(.sw-icon[data-state='open']) {
    background: var(--paper-3, #efeff1);
    color: var(--ink, #1d1d1f);
  }

  :global(.sw-empty) {
    padding: 8px;
    font-size: 12px;
    color: var(--ink-faint, #9a9a9e);
  }
</style>
