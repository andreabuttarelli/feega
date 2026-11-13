<script lang="ts">
  import { Region } from '$lib/canvas/key-region.svelte';
  import { _ } from 'svelte-i18n';
  import { cn } from '$lib/utils';
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
  import { renameProjectAction } from '$lib/canvas/canvas-list';
  import { UNCENSORED_NOTICE } from '$lib/uncensored-lock';
  import { Capability, modeAllows, modeOf, ProjectMode } from '$lib/project-mode';

  let {
    projectId,
    projectName,
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

<header class="canvas-topbar" data-key-region={Region.Commands}>
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
      <span class="project-name" data-testid="project-name" title={projectName} ondblclick={startRenameProject}>
        {#if inUncensored}
          <span class="uncensored-badge" data-testid="uncensored-project-badge" title={UNCENSORED_NOTICE}>Uncensored</span>
        {/if}
        <span class="truncate">{projectName}</span>
      </span>
    {/if}

    <CanvasConnect />
  </div>

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
    --topbar-mark-inset: 10px;
    height: 38px;
    padding: 0 3px 0 var(--topbar-mark-inset);
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

  .project-name {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
    max-width: 220px;
    height: var(--ui-control-h);
    padding: 0 10px;
    font-size: var(--ui-type-label);
    font-weight: var(--ui-weight-medium);
    color: var(--ui-text-secondary);
    cursor: default;
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
</style>
