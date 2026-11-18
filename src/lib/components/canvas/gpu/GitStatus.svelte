<script lang="ts">
  import GitBranch from '@lucide/svelte/icons/git-branch';
  import GitPullRequest from '@lucide/svelte/icons/git-pull-request';
  import History from '@lucide/svelte/icons/history';
  import { AutosaveState } from '$lib/canvas/code-autosave';
  import type { GitSummary } from '$lib/canvas/git-status';
  import { CiState } from '$lib/canvas/source-changes';

  let { summary, onchanges, onversions, onready, onresume }: { summary: GitSummary; onchanges: () => void; onversions: (nodeId: string) => void; onready: (nodeId: string) => void; onresume: () => void } = $props();

  const AUTOSAVE_LABEL: Record<AutosaveState, string> = {
    [AutosaveState.Idle]: 'up to date',
    [AutosaveState.Pending]: 'unsaved',
    [AutosaveState.Saving]: 'saving…',
    [AutosaveState.Saved]: 'saved',
    [AutosaveState.Conflict]: 'conflict',
    [AutosaveState.Paused]: 'paused',
    [AutosaveState.Failed]: 'not saved'
  };
  const CI_LABEL: Record<CiState, string> = { [CiState.None]: '', [CiState.Running]: 'CI running', [CiState.Passed]: 'CI passed', [CiState.Failed]: 'CI failed' };
  const STOPPED = new Set([AutosaveState.Conflict, AutosaveState.Paused, AutosaveState.Failed]);

  const repoName = $derived(summary.repo.split('/').at(-1) ?? summary.repo);
</script>

<div class="git-status" data-testid="git-status">
  <button type="button" class="seg" title="{summary.repo} · branch options" onclick={onchanges} data-testid="git-branch">
    <GitBranch size={14} />
    <span class="repo">{repoName}</span>
    <span class="branch">{summary.branch}</span>
  </button>
  {#if summary.upstream}
    <span class="seg muted" title="Files changed on {summary.base} since import" data-testid="git-upstream">↓{summary.upstream}</span>
  {/if}
  {#if STOPPED.has(summary.autosave)}
    <button type="button" class="seg state-{summary.autosave}" onclick={onresume} title="Open Changes to resolve, then resume autosave" data-testid="git-autosave">{AUTOSAVE_LABEL[summary.autosave]}</button>
  {:else}
    <span class="seg muted state-{summary.autosave}" data-testid="git-autosave">{AUTOSAVE_LABEL[summary.autosave]}</span>
  {/if}
  {#if summary.pull}
    <a class="seg" href={summary.pull.url} target="_blank" rel="noopener" title={CI_LABEL[summary.ci] || 'Pull request'} data-testid="git-pull">
      <GitPullRequest size={14} />#{summary.pull.number}{#if summary.draft}<span class="muted">draft</span>{/if}
      {#if summary.ci !== CiState.None}<span class="ci ci-{summary.ci}" aria-label={CI_LABEL[summary.ci]}></span>{/if}
    </a>
  {/if}
  {#if summary.draft}
    <button type="button" class="seg primary" onclick={() => onready(summary.nodeId)} data-testid="git-ready">Ready for review</button>
  {/if}
  <button type="button" class="seg icon" aria-label="Versions" title="Versions and compare" onclick={() => onversions(summary.nodeId)} data-testid="git-versions"><History size={14} /></button>
</div>

<style>
  .git-status {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    font-size: var(--ui-type-label, 12px);
  }
  .seg {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--ui-radius-sm);
    background: transparent;
    color: var(--ui-text-secondary);
    white-space: nowrap;
    text-decoration: none;
    cursor: pointer;
  }
  span.seg {
    cursor: default;
  }
  button.seg:hover,
  a.seg:hover {
    background: var(--ui-hover, rgba(0, 0, 0, 0.05));
  }
  .icon {
    padding: 0 6px;
  }
  .repo {
    color: var(--ui-text);
    font-weight: var(--ui-weight-medium);
  }
  .branch {
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .muted {
    color: var(--ui-text-muted);
  }
  .primary {
    background: var(--ui-text);
    color: var(--ui-panel-raised);
  }
  .primary:hover {
    background: var(--ui-text);
    opacity: 0.85;
  }
  .state-conflict,
  .state-failed {
    color: var(--ui-danger, #dc2626);
  }
  .ci {
    width: 6px;
    height: 6px;
    border-radius: var(--ui-radius-full);
    background: var(--ui-text-muted);
  }
  .ci-passed {
    background: var(--ui-success, #16a34a);
  }
  .ci-failed {
    background: var(--ui-danger, #dc2626);
  }
  .ci-running {
    background: var(--ui-warning, #d97706);
  }
</style>
