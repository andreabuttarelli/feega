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
    canvases,
    creditBalance,
    chatOpen,
    onToggleChat,
    shareToken,
    onShare
  }: {
    projectId: string;
    projectName: string;
    projects: ProjectRow[];
    canvasName: string;
    canvases: CanvasRow[];
    creditBalance: number;
    chatOpen: boolean;
    onToggleChat: () => void;
    shareToken: string | null;
    onShare: (state: ShareState) => Promise<void>;
  } = $props();

  /** "3 Sep" o "14:20" per oggi: distingue progetti con lo stesso nome nel menu. */
  function formatLastEdited(iso: string): string {
    const date = new Date(iso);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    return isToday
      ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  function openBilling() {
    openSheet(projectId, '/settings/billing').catch((err) => {
      console.error('apertura del foglio "billing" fallita', err);
    });
  }
</script>

<header class="canvas-topbar">
  <div class="top-box left">
    <CanvasMenu {projectId} />

    <DropdownMenu.Root>
      <DropdownMenu.Trigger class="switcher-btn">
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
      </DropdownMenu.Content>
    </DropdownMenu.Root>

    <span class="sep">/</span>

    <DropdownMenu.Root>
      <DropdownMenu.Trigger class="switcher-btn">
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
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>

  <div class="top-box right">
    <a href="#billing" class="credits" onclick={(e) => { e.preventDefault(); openBilling(); }}>
      <CreditAmount amount={creditBalance} />
    </a>

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
