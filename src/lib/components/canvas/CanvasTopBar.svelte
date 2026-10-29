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
  import CanvasConnect from './CanvasConnect.svelte';
  import ConnectionDot from './ConnectionDot.svelte';
  import { canvasLink } from '$lib/realtime/canvas-link';
  import type { ShareState } from '$lib/canvas/shared-view';
  import { LocalOff, isOff } from '$lib/local-user';
  import { BILLING_PATH } from '$lib/billing-path';
  import { formatLastEdited } from '$lib/canvas/format-last-edited';
  import { renameProjectAction } from '$lib/canvas/canvas-list';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Search from '@lucide/svelte/icons/search';
  import { UNCENSORED_NOTICE } from '$lib/uncensored-lock';
  import { matching, needsSearch, recentFirst } from '$lib/canvas/switcher-list';
  import { Capability, modeAllows, modeOf, ProjectMode } from '$lib/project-mode';

  type ProjectRow = { id: string; name: string; href: string; updatedAt: string; mode?: string };

  let {
    projectId,
    projectName,
    projects,
    canvasHref,
    creditBalance,
    chatOpen,
    onToggleChat,
    shareToken,
    onShare,
    profile,
    org,
    projectMode = ProjectMode.Standard
  }: {
    projectId: string;
    projectName: string;
    projects: ProjectRow[];
    canvasHref: string;
    creditBalance: number;
    chatOpen: boolean;
    onToggleChat: () => void;
    shareToken: string | null;
    onShare: (state: ShareState) => Promise<void>;
    profile: { name: string | null; email: string; avatarUrl: string | null };
    org: { name: string } | null;
    projectMode?: string;
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

  let renamingProject = $state(false);
  let draftProjectName = $state('');

  function startRenameProject() {
    draftProjectName = projectName;
    renamingProject = true;
  }

  async function saveRenameProject(event: SubmitEvent) {
    event.preventDefault();
    renamingProject = false;
    await renameProjectAction(canvasHref, draftProjectName);
  }

</script>

<header class="canvas-topbar">
  <div class="top-box top-group left">
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

    <CanvasConnect />
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

  <div class="top-slot" data-top-slot></div>
  <div class="top-box top-group right">
    <div class="top-peers" data-top-peers></div>
    {#if $canvasLink}
      <ConnectionDot state={$canvasLink} />
    {/if}
    {#if !isOff(LocalOff.Credits)}
      <a href={BILLING_PATH} class="credits">
        <CreditAmount amount={creditBalance} />
      </a>
    {/if}

    {#if modeAllows(mode, Capability.Share) && !isOff(LocalOff.Share)}
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
    inset: 0 0 auto;
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    height: 48px;
    padding: 0 10px;
    pointer-events: none;
  }

  .top-group {
    pointer-events: auto;
    height: 38px;
    padding: 0 3px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-panel-raised);
    box-shadow: var(--ui-shadow-float);
  }

  .top-slot {
    flex: 1;
    min-width: 0;
    align-self: stretch;
  }

  .top-box.left {
    flex-shrink: 1000;
    min-width: calc(var(--ui-control-h) + 8px);
    overflow: hidden;
  }

  .top-box.right {
    flex-shrink: 0;
  }

  .top-box.right > :global(.connection-dot) {
    margin-inline-start: 6px;
  }

  .top-box {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }

  .top-peers:empty {
    display: none;
  }

  :global(.switcher-btn) {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    max-width: 220px;
    appearance: none;
    border: 0;
    background: transparent;
    height: var(--ui-control-h);
    padding: 0 10px;
    border-radius: var(--ui-radius-full);
    font: inherit;
    font-size: var(--ui-type-body);
    font-weight: var(--ui-weight-semibold);
    color: var(--ui-text);
    cursor: pointer;
    transition: background-color var(--ui-dur-fast) var(--ui-ease);
  }
  :global(.switcher-btn:hover),
  :global(.switcher-btn[data-state='open']) {
    background: var(--ui-wash);
  }
  :global(.switcher-btn:focus-visible) {
    outline: none;
    box-shadow: var(--ui-ring);
  }

  .rename-form {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .rename-input {
    width: 180px;
    height: 28px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    box-shadow: var(--ui-ring);
    outline: none;
    padding: 0 8px;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    color: var(--ui-text);
    background: var(--ui-panel);
  }

  .rename-save {
    height: 28px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: var(--ui-accent-solid);
    color: var(--ui-on-accent);
    padding: 0 10px;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
  }

  .chat-toggle {
    display: grid;
    place-items: center;
    width: var(--ui-control-h);
    height: var(--ui-control-h);
    flex-shrink: 0;
    appearance: none;
    border: 0;
    border-radius: var(--ui-radius-full);
    background: transparent;
    color: var(--ui-icon-ink);
    cursor: pointer;
    transition: background-color var(--ui-dur-fast) var(--ui-ease);
  }
  .chat-toggle:hover {
    background: var(--ui-wash);
    color: var(--ui-text);
  }
  .chat-toggle:focus-visible {
    outline: none;
    box-shadow: var(--ui-ring);
  }
  .chat-toggle.is-active {
    background: var(--ui-selected);
    color: var(--ui-accent-text);
  }


  .credits {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    height: var(--ui-control-h);
    padding: 0 10px;
    border-radius: var(--ui-radius-full);
    font-family: var(--ui-mono);
    font-size: var(--ui-type-caption);
    color: var(--ui-text-secondary);
    background: var(--ui-input);
    font-variant-numeric: tabular-nums;
    text-decoration: none;
  }
  .credits:hover {
    color: var(--ui-text);
    background: var(--ui-wash);
  }

  .uncensored-badge {
    border: 1px solid var(--color-destructive);
    color: var(--color-destructive);
    padding: 0 0.25rem;
    font-size: 0.625rem;
    line-height: 1rem;
  }

  :global(.sw-menu) {
    --sw-row: var(--ui-row-lg);
    --sw-icon: 16px;
    max-width: calc(100vw - 16px);
    max-height: min(480px, var(--bits-dropdown-menu-content-available-height, 480px));
    padding: 4px;
    font-size: 13px;
    color: var(--ui-text);
  }
  :global(.sw-line.is-current) {
    background: var(--ui-selected);
    color: var(--ui-accent-text);
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
    color: var(--ui-text-tertiary);
    font-variant-numeric: tabular-nums;
  }

  :global(.sw-icon) {
    display: grid;
    place-items: center;
    width: var(--sw-row);
    height: var(--sw-row);
    flex-shrink: 0;
    color: var(--ui-text-secondary);
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
    background: var(--ui-wash);
    color: var(--ui-text);
  }

  :global(.sw-empty) {
    padding: 8px;
    font-size: 12px;
    color: var(--ui-text-tertiary);
  }
</style>
