<script lang="ts">
  import { _ } from 'svelte-i18n';
  import * as Sheet from '$lib/components/ui/sheet/index.js';
  import Check from '@lucide/svelte/icons/check';
  import { formatLastEdited } from '$lib/canvas/format-last-edited';
  import { CanvasAction, submitCanvasAction } from '$lib/canvas/canvas-list';

  type ProjectRow = { id: string; name: string; href: string; updatedAt: string };
  type CanvasRow = { id: string; name: string; href: string };

  let {
    open,
    onOpenChange,
    projectName,
    projects,
    canvasName,
    canvasHref,
    canvases
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectName: string;
    projects: ProjectRow[];
    canvasName: string;
    canvasHref: string | null;
    canvases: CanvasRow[];
  } = $props();

  let renaming = $state(false);
  let draftName = $state('');
  const lastCanvas = $derived(canvases.length <= 1);

  async function run(action: CanvasAction, fields: Record<string, string> = {}) {
    if (!canvasHref) {
      return;
    }
    onOpenChange(false);
    await submitCanvasAction(canvasHref, action, fields);
  }

  function startRename() {
    draftName = canvasName;
    renaming = true;
  }

  async function saveRename(event: SubmitEvent) {
    event.preventDefault();
    renaming = false;
    await run(CanvasAction.Rename, { name: draftName });
  }

  async function deleteCurrent() {
    if (lastCanvas || !confirm($_('app.shell.canvasActions.confirmDelete'))) {
      return;
    }
    await run(CanvasAction.Delete);
  }
</script>

<Sheet.Root {open} {onOpenChange}>
  <Sheet.Content side="bottom">
    <Sheet.Header>
      <Sheet.Title>{$_('app.shell.mobile.switchTitle')}</Sheet.Title>
    </Sheet.Header>

    <div class="section-label">{$_('app.shell.mobile.canvases')}</div>
    <div class="list">
      {#each canvases as canvas (canvas.id)}
        <a href={canvas.href} class="row" onclick={() => onOpenChange(false)}>
          <span class="truncate">{canvas.name}</span>
          {#if canvas.name === canvasName}
            <Check size={16} />
          {/if}
        </a>
      {/each}
    </div>

    {#if canvasHref}
      {#if renaming}
        <form class="rename-form" onsubmit={saveRename}>
          <input class="rename-input" data-testid="canvas-rename-input" bind:value={draftName} {@attach (el) => el.focus()} />
          <button type="submit" class="action">{$_('app.shell.canvasActions.save')}</button>
        </form>
      {:else}
        <div class="actions">
          <button type="button" class="action" data-testid="canvas-new" onclick={() => run(CanvasAction.New)}>
            {$_('app.shell.canvasActions.new')}
          </button>
          <button type="button" class="action" data-testid="canvas-rename" onclick={startRename}>
            {$_('app.shell.canvasActions.rename')}
          </button>
          <button
            type="button"
            class="action"
            data-testid="canvas-delete"
            disabled={lastCanvas}
            title={lastCanvas ? $_('app.shell.canvasActions.lastCanvas') : undefined}
            onclick={deleteCurrent}
          >
            {$_('app.shell.canvasActions.delete')}
          </button>
        </div>
      {/if}
    {/if}

    <div class="section-label">{$_('app.shell.mobile.projects')}</div>
    <div class="list list-last">
      {#each projects as project (project.id)}
        <a href={project.href} class="row" onclick={() => onOpenChange(false)}>
          <span class="truncate">{project.name}</span>
          <span class="meta">{formatLastEdited(project.updatedAt)}</span>
          {#if project.name === projectName}
            <Check size={16} />
          {/if}
        </a>
      {/each}
    </div>
  </Sheet.Content>
</Sheet.Root>

<style>
  .section-label {
    padding: 12px 12px 4px;
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
    gap: 8px;
    min-height: var(--touch-target);
    padding: 0 12px;
    text-decoration: none;
    color: var(--ink, #1d1d1f);
    font-size: 14px;
    font-weight: 600;
  }
  .row:hover {
    background: var(--paper-2, #f9f9f9);
  }

  .truncate {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    flex: 1 1 auto;
    min-width: 0;
  }

  .meta {
    font-size: 11px;
    font-weight: 400;
    color: var(--ink-faint, #9a9a9e);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .actions,
  .rename-form {
    display: flex;
    gap: 4px;
    padding: 8px 16px 0;
  }

  .action {
    flex: 1 1 0;
    min-height: var(--touch-target);
    border: 1px solid var(--line, #e5e5e7);
    background: var(--paper, #fff);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink, #1d1d1f);
  }
  .action:disabled {
    color: var(--ink-faint, #9a9a9e);
  }

  .rename-input {
    flex: 3 1 0;
    min-height: var(--touch-target);
    border: 1px solid var(--line, #e5e5e7);
    padding: 0 12px;
    font: inherit;
    font-size: 16px;
  }

  .list-last {
    padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  }
</style>
