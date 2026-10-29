<script lang="ts">
  import { _ } from 'svelte-i18n';
  import * as Sheet from '$lib/components/ui/sheet/index.js';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import Check from '@lucide/svelte/icons/check';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Search from '@lucide/svelte/icons/search';
  import { formatLastEdited } from '$lib/canvas/format-last-edited';
  import { renameProjectAction } from '$lib/canvas/canvas-list';
  import { matching, needsSearch, recentFirst } from '$lib/canvas/switcher-list';
  import PagesList from './PagesList.svelte';
  import { Density } from '$lib/canvas/layer-density';

  type ProjectRow = { id: string; name: string; href: string; updatedAt: string };
  type CanvasRow = { id: string; name: string; href: string };

  const ICON = 16;

  let {
    open,
    onOpenChange,
    projectName,
    brandName = null,
    projects: projectRows,
    canvasName,
    canvasHref,
    canvases
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectName: string;
    brandName?: string | null;
    projects: ProjectRow[];
    canvasName: string;
    canvasHref: string | null;
    canvases: CanvasRow[];
  } = $props();

  let query = $state('');
  const searchable = $derived(needsSearch(projectRows.length));
  const projects = $derived(matching(recentFirst(projectRows), query));

  const currentId = $derived(canvases.find((canvas) => canvas.href === canvasHref)?.id ?? null);

  let renamingProject = $state(false);
  let draftProjectName = $state('');

  function startRenameProject() {
    draftProjectName = projectName;
    renamingProject = true;
  }

  async function saveRenameProject(event: SubmitEvent) {
    event.preventDefault();
    renamingProject = false;
    if (!canvasHref) {
      return;
    }
    await renameProjectAction(canvasHref, draftProjectName);
  }

</script>

<Sheet.Root {open} {onOpenChange}>
  <Sheet.Content side="bottom" class="switcher-sheet gap-0">
    <div class="head">
      <div class="grabber" aria-hidden="true"></div>
      <Sheet.Header class="flex-row items-center gap-2 px-4 py-3 pr-14 text-left">
        <Sheet.Title class="min-w-0 truncate text-base font-semibold" title={projectName}>{projectName}</Sheet.Title>
        {#if brandName}
          <Badge variant="outline" data-testid="switcher-brand">{brandName}</Badge>
        {/if}
      </Sheet.Header>
      {#if searchable}
        <label class="search">
          <Search size={ICON} />
          <input bind:value={query} data-testid="project-search" placeholder={$_('app.shell.canvasActions.searchProjects')} />
        </label>
      {/if}
    </div>

    <div class="pages-section">
      <PagesList {canvases} {currentId} density={Density.Touch} onpick={() => onOpenChange(false)} />
    </div>

    <div class="section-label">{$_('app.shell.mobile.projects')}</div>
    <div class="list list-last">
      {#each projects as project (project.id)}
        {@const current = project.name === projectName}
        {#if current && renamingProject}
          <form class="row rename-form" onsubmit={saveRenameProject}>
            <input
              class="rename-input"
              data-testid="project-rename-input"
              bind:value={draftProjectName}
              {@attach (el) => el.focus()}
              onkeydown={(e) => e.key === 'Escape' && (renamingProject = false)}
            />
            <button type="submit" class="save">{$_('app.shell.canvasActions.save')}</button>
          </form>
        {:else}
          <div class="row" class:is-current={current}>
            <a href={project.href} class="link" title={project.name} onclick={() => onOpenChange(false)}>
              <span class="lead">{#if current}<Check size={ICON} />{/if}</span>
              <span class="truncate">{project.name}</span>
              <span class="meta">{formatLastEdited(project.updatedAt)}</span>
            </a>
            {#if current && canvasHref}
              <button
                type="button"
                class="icon"
                data-testid="project-rename"
                aria-label={$_('app.shell.canvasActions.renameProject')}
                onclick={startRenameProject}
              >
                <Pencil size={ICON} />
              </button>
            {/if}
          </div>
        {/if}
      {:else}
        <div class="empty">{$_('app.shell.canvasActions.noMatch')}</div>
      {/each}
    </div>
  </Sheet.Content>
</Sheet.Root>

<style>
  :global(.switcher-sheet) {
    max-height: 85dvh;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .head {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--popover, var(--paper, #fff));
    border-bottom: 1px solid var(--line, #ededef);
  }

  .grabber {
    width: 32px;
    height: 4px;
    margin: 8px auto 0;
    background: var(--line-2, #d2d2d7);
  }

  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: var(--touch-target);
    box-sizing: border-box;
    width: calc(100% - 32px);
    margin: 0 16px 12px;
    padding: 0 12px;
    border: 1px solid var(--line, #ededef);
    color: var(--ink-faint, #9a9a9e);
  }
  .search input {
    flex: 1 1 auto;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    font: inherit;
    font-size: 16px;
    color: var(--ink, #1d1d1f);
  }

  .section-label {
    padding: 16px 16px 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-faint, #9a9a9e);
  }

  .list {
    display: flex;
    flex-direction: column;
    padding: 0 4px;
  }

  .row {
    display: flex;
    align-items: center;
    min-height: var(--touch-target);
    color: var(--ink, #1d1d1f);
  }
  .row.is-current {
    background: var(--paper-3, #f4f4f4);
  }

  .link {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 12px;
    min-width: 0;
    min-height: var(--touch-target);
    padding: 0 12px;
    border: 0;
    background: transparent;
    font: inherit;
    font-size: 15px;
    text-align: left;
    text-decoration: none;
    color: inherit;
  }
  .row.is-current .link {
    font-weight: 600;
  }
  .link:active {
    background: var(--paper-3, #f4f4f4);
  }

  .pages-section {
    padding: 8px 8px 0;
  }

  .lead {
    display: grid;
    place-items: center;
    width: 16px;
    flex-shrink: 0;
  }

  .truncate {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    flex: 1 1 auto;
    min-width: 0;
  }

  .meta {
    font-size: 12px;
    font-weight: 400;
    color: var(--ink-faint, #9a9a9e);
    white-space: nowrap;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }

  .row :global(.icon) {
    display: grid;
    place-items: center;
    width: var(--touch-target);
    height: var(--touch-target);
    flex-shrink: 0;
    border: 0;
    background: transparent;
    color: var(--ink-soft, #6e6e73);
  }
  .row :global(.icon:active) {
    background: var(--paper-3, #f4f4f4);
  }

  .rename-form {
    gap: 4px;
    padding: 0 4px;
  }

  .rename-input {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 36px;
    border: 1px solid var(--ink, #1d1d1f);
    padding: 0 8px;
    font: inherit;
    font-size: 16px;
  }

  .save {
    min-height: 36px;
    padding: 0 12px;
    border: 1px solid var(--ink, #1d1d1f);
    background: var(--ink, #1d1d1f);
    color: var(--paper, #fff);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
  }

  .empty {
    padding: 12px 16px;
    font-size: 13px;
    color: var(--ink-faint, #9a9a9e);
  }

  .list-last {
    padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  }
</style>
