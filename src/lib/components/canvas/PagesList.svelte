<script lang="ts">
  import { _ } from 'svelte-i18n';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
  import Plus from '@lucide/svelte/icons/plus';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Trash from '@lucide/svelte/icons/trash-2';
  import Ellipsis from '@lucide/svelte/icons/ellipsis';
  import History from '@lucide/svelte/icons/history';
  import MessageSquare from '@lucide/svelte/icons/message-square';
  import Download from '@lucide/svelte/icons/download';
  import Upload from '@lucide/svelte/icons/upload';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import FeegaFile from './FeegaFile.svelte';
  import { CanvasAction, submitCanvasAction } from '$lib/canvas/canvas-list';
  import { LocalOff, isOff } from '$lib/local-user';
  import { Density } from '$lib/canvas/layer-density';

  type CanvasRow = { id: string; name: string; href: string };

  let {
    canvases,
    currentId,
    onVersions = null,
    onComments = null,
    commentsUnseen = false,
    onpick = () => {},
    density = Density.Pointer
  }: {
    canvases: CanvasRow[];
    currentId: string | null;
    onVersions?: (() => void) | null;
    onComments?: (() => void) | null;
    commentsUnseen?: boolean;
    onpick?: () => void;
    density?: Density;
  } = $props();

  const ICON = 14;

  const current = $derived(canvases.find((canvas) => canvas.id === currentId) ?? null);
  const lastCanvas = $derived(canvases.length <= 1);

  let feegaFile = $state<FeegaFile | null>(null);
  let renaming = $state(false);
  let draftName = $state('');
  let confirmingDelete = $state(false);

  async function run(action: CanvasAction, fields: Record<string, string> = {}) {
    if (!current) {
      return;
    }
    onpick();
    await submitCanvasAction(current.href, action, fields);
  }

  function startRename() {
    draftName = current?.name ?? '';
    renaming = true;
  }

  async function saveRename(event: SubmitEvent) {
    event.preventDefault();
    renaming = false;
    await run(CanvasAction.Rename, { name: draftName });
  }

  function askDelete() {
    if (lastCanvas) {
      return;
    }
    confirmingDelete = true;
  }
</script>

<section class="pages" class:touch={density === Density.Touch} data-testid="pages">
  <div class="pages-head">
    <span class="pages-label">{$_('app.shell.pages')}</span>
    {#if !isOff(LocalOff.NewCanvas)}
      <button type="button" class="pages-icon" data-testid="canvas-new" aria-label={$_('app.shell.canvasActions.new')} title={$_('app.shell.canvasActions.new')} onclick={() => run(CanvasAction.New)}>
        <Plus size={ICON} />
      </button>
    {/if}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger class="pages-icon" data-testid="pages-menu" aria-label={$_('app.shell.canvasActions.more')}>
        <Ellipsis size={ICON} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" collisionPadding={8} class="w-48">
        {#if !isOff(LocalOff.ImportCanvas)}
          <DropdownMenu.Item data-testid="canvas-import-feega" onSelect={() => feegaFile?.pick()}>
            <Upload size={ICON} />
            Import .feega…
          </DropdownMenu.Item>
        {/if}
        <DropdownMenu.Item data-testid="canvas-save-feega" onSelect={() => feegaFile?.save()}>
          <Download size={ICON} />
          Download .feega
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>

  <ul class="pages-list">
    {#each canvases as canvas (canvas.id)}
      {@const isCurrent = canvas.id === currentId}
      <li class="page-row" class:is-current={isCurrent} data-testid={isCurrent ? 'canvas-row-current' : undefined}>
        {#if isCurrent && renaming}
          <form class="rename-form" onsubmit={saveRename}>
            <input
              class="rename-input"
              data-testid="canvas-rename-input"
              bind:value={draftName}
              {@attach (el) => el.focus()}
              onkeydown={(e) => e.key === 'Escape' && (renaming = false)}
            />
          </form>
        {:else}
          <a class="page-link" href={canvas.href} title={canvas.name} aria-current={isCurrent ? 'page' : undefined} onclick={onpick} ondblclick={isCurrent ? startRename : undefined}>
            <span class="page-name">{canvas.name}</span>
            {#if isCurrent && commentsUnseen}<span class="unseen-dot" data-testid="comments-unseen" role="img" aria-label="Unread mention"></span>{/if}
          </a>
        {/if}
        {#if isCurrent && !renaming}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger class="pages-icon" data-testid="canvas-more" aria-label={$_('app.shell.canvasActions.more')}>
              <Ellipsis size={ICON} />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" collisionPadding={8} class="w-44">
              <DropdownMenu.Item data-testid="canvas-rename" onSelect={startRename}>
                <Pencil size={ICON} />
                {$_('app.shell.canvasActions.rename')}
              </DropdownMenu.Item>
              {#if onVersions}
                <DropdownMenu.Item data-testid="canvas-versions" onSelect={onVersions}>
                  <History size={ICON} />
                  Versions…
                </DropdownMenu.Item>
              {/if}
              {#if onComments}
                <DropdownMenu.Item data-testid="canvas-comments" onSelect={onComments}>
                  <MessageSquare size={ICON} />
                  Comments
                </DropdownMenu.Item>
              {/if}
              <DropdownMenu.Separator />
              <DropdownMenu.Item
                variant="destructive"
                data-testid="canvas-delete"
                disabled={lastCanvas}
                title={lastCanvas ? $_('app.shell.canvasActions.lastCanvas') : undefined}
                onSelect={askDelete}
              >
                <Trash size={ICON} />
                {$_('app.shell.canvasActions.delete')}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        {/if}
      </li>
    {/each}
  </ul>

  {#if current}
    <FeegaFile bind:this={feegaFile} page={current.href} />
  {/if}

  <ConfirmDialog
    bind:open={confirmingDelete}
    title={$_('app.shell.canvasActions.confirmDeleteTitle')}
    body={$_('app.shell.canvasActions.confirmDeleteBody')}
    confirmLabel={$_('app.shell.canvasActions.confirmDeleteCta')}
    cancelLabel={$_('app.shell.canvasActions.confirmDeleteCancel')}
    onConfirm={() => run(CanvasAction.Delete)}
  />
</section>

<style>
  .pages {
    --row-h: 28px;
    display: flex;
    flex-direction: column;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--ui-line);
  }
  .pages.touch {
    --row-h: var(--touch-target);
  }

  .pages-head {
    display: flex;
    align-items: center;
    gap: 2px;
    height: var(--row-h);
    padding: 0 2px 0 8px;
  }
  .pages-label {
    flex: 1 1 auto;
    font-size: 11px;
    font-weight: var(--ui-weight-semibold);
    color: var(--ui-text-secondary);
  }

  .pages-list {
    margin: 0;
    padding: 0;
    list-style: none;
    max-height: 30vh;
    overflow-y: auto;
  }

  .page-row {
    display: flex;
    align-items: center;
    height: var(--row-h);
    border-radius: var(--ui-radius-sm);
    color: var(--ui-text);
  }
  .page-row:hover {
    background: var(--ui-hover);
  }
  .page-row.is-current {
    background: var(--ui-selected);
    font-weight: var(--ui-weight-semibold);
  }

  .page-link {
    display: flex;
    align-items: center;
    flex: 1 1 auto;
    min-width: 0;
    height: 100%;
    padding: 0 8px;
    font-size: var(--ui-type-body);
    text-decoration: none;
    color: inherit;
  }
  .page-name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .pages :global(.pages-icon) {
    display: grid;
    place-items: center;
    flex: none;
    width: var(--row-h);
    height: var(--row-h);
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-secondary);
  }
  .pages :global(.pages-icon:hover) {
    background: var(--ui-hover);
    color: var(--ui-text);
  }

  .rename-form {
    flex: 1 1 auto;
    padding: 0 2px;
  }
  .rename-input {
    width: 100%;
    height: calc(var(--row-h) - 4px);
    padding: 0 6px;
    border: 1px solid var(--ui-accent);
    border-radius: var(--ui-radius-sm);
    background: transparent;
    font: inherit;
    font-size: max(12px, 1em);
    color: inherit;
  }
  .touch .rename-input {
    font-size: 16px;
  }

  .unseen-dot {
    flex: none;
    width: 8px;
    height: 8px;
    margin-left: 6px;
    background: #0b6bff;
    border-radius: 9999px;
  }
</style>
