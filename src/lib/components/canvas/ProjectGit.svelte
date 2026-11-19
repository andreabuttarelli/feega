<script lang="ts">
  import { onMount } from 'svelte';
  import { Portal } from 'bits-ui';
  import GitBranch from '@lucide/svelte/icons/git-branch';
  import GitCommit from '@lucide/svelte/icons/git-commit-horizontal';
  import ArrowUp from '@lucide/svelte/icons/arrow-up';
  import GitPullRequest from '@lucide/svelte/icons/git-pull-request';
  import Hint from '$lib/components/ui/shell/Hint.svelte';
  import { Side } from '$lib/components/ui/shell/styles';

  type Status = { git: false } | { git: true; branch: string | null; changes: number; ahead: number; origin: { github: string | null } | null };
  type Action = 'commit' | 'push' | 'pull';

  const ENDPOINT = '/local/git';
  const POLL_MS = 5000;
  const SLOT = '[data-top-git]';

  let status = $state<Status | null>(null);
  let slot = $state<HTMLElement | null>(null);
  let busy = $state<Action | null>(null);
  let note = $state('');

  async function load() {
    const res = await fetch(ENDPOINT).catch(() => null);
    status = res?.ok ? await res.json() : null;
  }

  async function act(action: Action) {
    busy = action;
    note = '';
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) }).catch(() => null);
    const body = await res?.json().catch(() => null);
    busy = null;
    if (!res?.ok) {
      note = body?.message ?? 'Git could not finish.';
      return;
    }
    status = body;
    if (body?.url) {
      window.open(body.url, '_blank', 'noopener');
    }
  }

  onMount(() => {
    slot = document.querySelector<HTMLElement>(SLOT);
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  });
</script>

{#if slot && status?.git}
  <Portal to={slot}>
    <div class="git" data-testid="project-git">
      <Hint label={note || 'Branch of the project folder'} side={Side.Bottom}>
        {#snippet children(props)}
          <span {...props} class="chip" class:warn={note} data-testid="project-git-branch"><GitBranch size={14} /><span class="branch">{status?.git ? (status.branch ?? 'detached') : ''}</span></span>
        {/snippet}
      </Hint>

      {#if status.changes}
        <Hint label="Commit the canvas ({status.changes} changed files in .feega/)" side={Side.Bottom}>
          {#snippet children(props)}
            <button {...props} type="button" class="chip" disabled={busy !== null} onclick={() => act('commit')} data-testid="project-git-commit"><GitCommit size={14} />{status?.git ? status.changes : ''}</button>
          {/snippet}
        </Hint>
      {/if}

      {#if status.origin && status.ahead}
        <Hint label="Push {status.ahead} commits to origin" side={Side.Bottom}>
          {#snippet children(props)}
            <button {...props} type="button" class="chip" disabled={busy !== null} onclick={() => act('push')} data-testid="project-git-push"><ArrowUp size={14} />{status?.git ? status.ahead : ''}</button>
          {/snippet}
        </Hint>
      {/if}

      {#if status.origin?.github}
        <Hint label="Open a pull request on {status.origin.github}" side={Side.Bottom}>
          {#snippet children(props)}
            <button {...props} type="button" class="chip" aria-label="Pull request" disabled={busy !== null} onclick={() => act('pull')} data-testid="project-git-pull"><GitPullRequest size={14} /></button>
          {/snippet}
        </Hint>
      {/if}
    </div>
  </Portal>
{/if}

<style>
  .git {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-inline-end: 4px;
    padding-inline-end: 6px;
    border-inline-end: 1px solid var(--ui-divider, var(--ui-border));
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-secondary);
    font-size: var(--ui-type-label);
    white-space: nowrap;
  }
  button.chip {
    cursor: pointer;
  }
  button.chip:hover {
    background: var(--ui-wash);
    color: var(--ui-text);
  }
  button.chip:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .branch {
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--ui-text);
    font-weight: var(--ui-weight-medium);
  }
  .warn {
    color: var(--ui-warn);
  }
</style>
