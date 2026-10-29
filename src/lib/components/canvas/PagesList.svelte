<script lang="ts">
  import { _ } from 'svelte-i18n';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
  import Plus from '@lucide/svelte/icons/plus';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import Pencil from '@lucide/svelte/icons/pencil';
  import Trash from '@lucide/svelte/icons/trash-2';
  import Ellipsis from '@lucide/svelte/icons/ellipsis';
  import History from '@lucide/svelte/icons/history';
  import MessageSquare from '@lucide/svelte/icons/message-square';
  import Download from '@lucide/svelte/icons/download';
  import Upload from '@lucide/svelte/icons/upload';
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
  import FeegaFile from './FeegaFile.svelte';
  import { canvasPages } from '$lib/canvas/canvas-pages.svelte';
  import { OpOutcome } from '$lib/canvas/optimistic-ops';
  import { PageAction } from '$lib/canvas/page-ops';
  import { canvasRouteOf } from '$lib/canvas/canvas-action-url';
  import { LocalOff, isOff } from '$lib/local-user';
  import { Density } from '$lib/canvas/layer-density';

  type CanvasRow = { id: string; name: string; href: string };

  let {
    canvases,
    currentId,
    onHistory = null,
    onComments = null,
    commentsUnseen = false,
    onpick = () => {},
    density = Density.Pointer
  }: {
    canvases: CanvasRow[];
    currentId: string | null;
    onHistory?: (() => void) | null;
    onComments?: (() => void) | null;
    commentsUnseen?: boolean;
    onpick?: () => void;
    density?: Density;
  } = $props();

  const ICON = 14;
  const ROW_PX = 28;
  const DEFAULT_ROWS = 4;
  const MAX_LIST_VH = 0.6;

  let collapsed = $state(false);
  let listHeight = $state(ROW_PX * DEFAULT_ROWS);

  function resize(e: PointerEvent) {
    const handle = e.currentTarget as HTMLElement;
    const startY = e.clientY;
    const startHeight = listHeight;
    handle.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent) => {
      listHeight = Math.min(window.innerHeight * MAX_LIST_VH, Math.max(ROW_PX, startHeight + m.clientY - startY));
    };
    const stop = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', stop);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', stop);
  }

  const rows = $derived(canvasPages.list(canvases));
  const current = $derived(rows.find((canvas) => canvas.id === currentId) ?? null);
  const lastCanvas = $derived(rows.length <= 1);

  let feegaFile = $state<FeegaFile | null>(null);
  let renaming = $state(false);
  let draftName = $state('');
  let confirmingDelete = $state(false);

  function addPage() {
    const projectId = current ? canvasRouteOf(current.href)?.projectId : null;
    if (!current || !projectId) {
      return;
    }
    onpick();
    const id = crypto.randomUUID();
    void canvasPages.run(PageAction.New, { id, from: current.id, projectId }, canvases, current.href).then((outcome) => {
      if (outcome === OpOutcome.Landed) {
        void canvasPages.open(`/p/${projectId}/c/${id}`);
      }
    });
  }

  function deletePage() {
    const next = rows.find((canvas) => canvas.id !== current?.id);
    if (!current || !next) {
      return;
    }
    onpick();
    void canvasPages.run(PageAction.Delete, { id: current.id }, canvases, current.href);
    void canvasPages.open(next.href);
  }

  function startRename() {
    draftName = current?.name ?? '';
    renaming = true;
  }

  function saveRename(event: SubmitEvent) {
    event.preventDefault();
    renaming = false;
    if (current) {
      void canvasPages.run(PageAction.Rename, { id: current.id, name: draftName }, canvases, current.href);
    }
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
    <button type="button" class="pages-toggle" data-testid="pages-toggle" aria-expanded={!collapsed} onclick={() => (collapsed = !collapsed)}>
      {#if collapsed}<ChevronRight size={12} />{:else}<ChevronDown size={12} />{/if}
      <span class="pages-label">{$_('app.shell.pages')}</span>
    </button>
    {#if !isOff(LocalOff.NewCanvas)}
      <button type="button" class="pages-icon" data-testid="canvas-new" aria-label={$_('app.shell.canvasActions.new')} title={$_('app.shell.canvasActions.new')} onclick={addPage}>
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

  <ul class="pages-list" hidden={collapsed} style:max-height={density === Density.Pointer ? `${listHeight}px` : undefined}>
    {#each rows as canvas (canvas.id)}
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
            <DropdownMenu.Trigger class="pages-icon row-more" data-testid="canvas-more" aria-label={$_('app.shell.canvasActions.more')}>
              <Ellipsis size={ICON} />
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" collisionPadding={8} class="w-44">
              <DropdownMenu.Item data-testid="canvas-rename" onSelect={startRename}>
                <Pencil size={ICON} />
                {$_('app.shell.canvasActions.rename')}
              </DropdownMenu.Item>
              {#if onHistory}
                <DropdownMenu.Item data-testid="canvas-history" onSelect={onHistory}>
                  <History size={ICON} />
                  History
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

  {#if !collapsed && density === Density.Pointer}
    <div class="pages-resize" role="separator" aria-orientation="horizontal" aria-label="Resize pages" data-testid="pages-resize" onpointerdown={resize}></div>
  {/if}

  {#if current}
    <FeegaFile bind:this={feegaFile} page={current.href} />
  {/if}

  <ConfirmDialog
    bind:open={confirmingDelete}
    title={$_('app.shell.canvasActions.confirmDeleteTitle')}
    body={$_('app.shell.canvasActions.confirmDeleteBody')}
    confirmLabel={$_('app.shell.canvasActions.confirmDeleteCta')}
    cancelLabel={$_('app.shell.canvasActions.confirmDeleteCancel')}
    onConfirm={deletePage}
  />

  {#if canvasPages.notice}
    <p class="pages-notice" role="alert" data-testid="pages-notice">
      {canvasPages.notice}
      <button type="button" aria-label="Dismiss" onclick={() => canvasPages.dismiss()}>×</button>
    </p>
  {/if}
</section>

<style>
  .pages-notice {
    display: flex;
    gap: 6px;
    align-items: center;
    margin: 4px 0;
    font-size: 12px;
    color: var(--destructive);
  }
  .pages-notice button {
    margin-left: auto;
  }
  .pages {
    --row-h: 28px;
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    padding: 4px 6px 0;
  }
  .pages.touch {
    --row-h: var(--touch-target);
    padding: 0;
  }

  .pages-head {
    display: flex;
    align-items: center;
    gap: 2px;
    height: var(--row-h);
  }

  .pages-toggle {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 4px;
    height: 100%;
    padding: 0 4px;
    border: 0;
    background: transparent;
    color: var(--ui-text-secondary);
    text-align: left;
  }

  .pages-label {
    font-size: 11px;
    font-weight: var(--ui-weight-medium);
  }

  .pages-list {
    margin: 0;
    padding: 0;
    list-style: none;
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
    background: color-mix(in srgb, var(--ui-text) 5%, transparent);
  }
  .page-row.is-current {
    background: color-mix(in srgb, var(--ui-text) 9%, transparent);
    font-weight: var(--ui-weight-medium);
  }

  .page-link {
    display: flex;
    align-items: center;
    flex: 1 1 auto;
    min-width: 0;
    height: 100%;
    padding: 0 8px 0 20px;
    font-size: 12px;
    text-decoration: none;
    color: inherit;
  }
  .touch .page-link {
    font-size: 15px;
    padding-left: 12px;
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
    width: 24px;
    height: 24px;
    margin-right: 2px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-secondary);
  }
  .touch :global(.pages-icon) {
    width: var(--row-h);
    height: var(--row-h);
  }
  .pages :global(.pages-icon:hover) {
    background: var(--ui-hover);
    color: var(--ui-text);
  }
  .pages :global(.row-more) {
    opacity: 0;
  }
  .page-row:hover :global(.row-more),
  .page-row:focus-within :global(.row-more),
  .pages :global(.row-more[data-state='open']),
  .touch :global(.row-more) {
    opacity: 1;
  }

  .pages-resize {
    flex: none;
    height: 7px;
    margin: 0 -6px;
    cursor: row-resize;
    background: linear-gradient(var(--ui-divider), var(--ui-divider)) center / 100% 1px no-repeat;
  }
  .pages-resize:hover {
    background-size: 100% 2px;
  }

  .rename-form {
    flex: 1 1 auto;
    padding: 0 2px;
  }
  .rename-input {
    box-sizing: border-box;
    width: 100%;
    height: calc(var(--row-h) - 4px);
    padding: 0 6px 0 18px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    box-shadow: var(--ui-ring);
    background: var(--ui-panel);
    font: inherit;
    font-size: 12px;
    color: inherit;
    outline: none;
  }
  .touch .rename-input {
    font-size: 16px;
  }

  .unseen-dot {
    flex: none;
    width: 6px;
    height: 6px;
    margin-left: 6px;
    background: var(--ui-accent);
    border-radius: var(--ui-radius-full);
  }
</style>
